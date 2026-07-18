import crypto from "node:crypto";
import { eq, and, lte } from "drizzle-orm";
import { db, bookingsTable, webhookDeliveriesTable } from "@workspace/db";
import { logger } from "./logger.js";

type Booking = typeof bookingsTable.$inferSelect;

export type WebhookEvent = "funded" | "answered" | "released" | "refunded" | "expired";

// Retry schedule (~24h total): 30s, 1m, 5m, 15m, 1h, 4h, 8h, 12h.
const RETRY_DELAYS_MS = [
  30_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  4 * 60 * 60_000,
  8 * 60 * 60_000,
  12 * 60 * 60_000,
];

const DELIVERY_TIMEOUT_MS = 10_000;
const WORKER_TICK_MS = 5_000;

export function signWebhookPayload(secret: string, body: string, timestamp: number): string {
  const mac = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

function parseLinks(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function buildPayload(b: Booking, event: WebhookEvent) {
  return {
    event,
    escrowId: b.escrowBookingId,
    state: event,
    expertHandle: b.expertHandle,
    expertWallet: b.expertWallet,
    buyerWallet: b.buyerWallet,
    channelId: b.channel,
    amountUsdc: b.amountUsdc,
    feeUsdc: b.feeUsdc,
    answer: b.agentAnswerText
      ? { text: b.agentAnswerText, links: parseLinks(b.agentAnswerLinks) }
      : null,
    txHashes: {
      book: b.bookTxHash && !b.bookTxHash.startsWith("pending-") ? b.bookTxHash : null,
      release: b.releaseTxHash,
      refund: b.refundTxHash,
    },
    createdAt: b.createdAt.toISOString(),
  };
}

/**
 * Persist a webhook delivery for asynchronous dispatch. The worker picks up
 * pending rows by `next_attempt_at` and walks the retry schedule independent
 * of process restarts.
 */
export async function enqueueWebhook(opts: { booking: Booking; event: WebhookEvent }): Promise<void> {
  const b = opts.booking;
  if (!b.callbackUrl || !b.webhookSecret) return;
  const body = JSON.stringify(buildPayload(b, opts.event));
  try {
    await db.insert(webhookDeliveriesTable).values({
      escrowBookingId: b.escrowBookingId,
      event: opts.event,
      url: b.callbackUrl,
      payload: body,
      status: "pending",
      attempt: 0,
      nextAttemptAt: new Date(),
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message, escrowId: b.escrowBookingId, event: opts.event }, "Failed to enqueue webhook");
  }
}

async function loadSecret(escrowBookingId: string): Promise<string | null> {
  const [row] = await db
    .select({ secret: bookingsTable.webhookSecret })
    .from(bookingsTable)
    .where(eq(bookingsTable.escrowBookingId, escrowBookingId))
    .limit(1);
  return row?.secret ?? null;
}

async function deliverOne(row: typeof webhookDeliveriesTable.$inferSelect): Promise<void> {
  const secret = await loadSecret(row.escrowBookingId);
  if (!secret) {
    await db
      .update(webhookDeliveriesTable)
      .set({ status: "failed", lastError: "secret missing", updatedAt: new Date() })
      .where(eq(webhookDeliveriesTable.id, row.id));
    return;
  }
  const ts = Math.floor(Date.now() / 1000);
  const sig = signWebhookPayload(secret, row.payload, ts);

  let ok = false;
  let status = 0;
  let errMsg: string | null = null;
  try {
    const resp = await fetch(row.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "LINKY-Signature": sig,
        "LINKY-Event": row.event,
        "LINKY-Escrow-Id": row.escrowBookingId,
        "User-Agent": "LINKY-Webhooks/1.0",
      },
      body: row.payload,
      redirect: "error",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    status = resp.status;
    ok = status >= 200 && status < 300;
  } catch (err) {
    errMsg = (err as Error).message;
  }

  if (ok) {
    logger.info({ url: row.url, escrowId: row.escrowBookingId, event: row.event, attempt: row.attempt }, "Webhook delivered");
    await db
      .update(webhookDeliveriesTable)
      .set({ status: "delivered", lastStatusCode: status, updatedAt: new Date() })
      .where(eq(webhookDeliveriesTable.id, row.id));
    return;
  }

  const nextAttempt = row.attempt + 1;
  if (nextAttempt > RETRY_DELAYS_MS.length) {
    logger.error({ url: row.url, escrowId: row.escrowBookingId, event: row.event }, "Webhook delivery exhausted");
    await db
      .update(webhookDeliveriesTable)
      .set({
        status: "failed",
        attempt: nextAttempt,
        lastStatusCode: status || null,
        lastError: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(webhookDeliveriesTable.id, row.id));
    return;
  }

  const delay = RETRY_DELAYS_MS[row.attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
  await db
    .update(webhookDeliveriesTable)
    .set({
      attempt: nextAttempt,
      lastStatusCode: status || null,
      lastError: errMsg,
      nextAttemptAt: new Date(Date.now() + delay),
      updatedAt: new Date(),
    })
    .where(eq(webhookDeliveriesTable.id, row.id));
  logger.warn(
    { url: row.url, escrowId: row.escrowBookingId, event: row.event, attempt: row.attempt, status, err: errMsg },
    "Webhook will retry",
  );
}

let workerStarted = false;
export function startWebhookWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  const tick = async () => {
    try {
      const due = await db
        .select()
        .from(webhookDeliveriesTable)
        .where(
          and(
            eq(webhookDeliveriesTable.status, "pending"),
            lte(webhookDeliveriesTable.nextAttemptAt, new Date()),
          ),
        )
        .limit(20);
      for (const row of due) {
        await deliverOne(row);
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Webhook worker tick failed");
    } finally {
      setTimeout(tick, WORKER_TICK_MS).unref?.();
    }
  };
  setTimeout(tick, WORKER_TICK_MS).unref?.();
  logger.info("Webhook delivery worker started");
}
