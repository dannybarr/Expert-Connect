import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { db, expertsTable, bookingsTable } from "@workspace/db";
import { eq, desc, ne, and, sql } from "drizzle-orm";
import { parseUnits } from "viem";
import {
  verifySignedMessage,
  getChainId,
  getChainName,
  getEscrowAddress,
  getUsdcAddress,
  getPlatformFeeBps,
  getRefundDelaySeconds,
} from "../lib/auth.js";
import { extractBooked } from "../lib/escrow-events.js";
import { requireAuth } from "../lib/require-auth.js";
import { enqueueWebhook } from "../lib/webhooks.js";
import { rateLimit } from "../lib/rate-limit.js";
import { validateWebhookUrl } from "../lib/safe-url.js";

const router: IRouter = Router();

// All /v1 endpoints share a per-IP rate limit. Cheap, in-memory, fine for v1.
router.use(rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "v1" }));

type ExpertRow = typeof expertsTable.$inferSelect;
type BookingRow = typeof bookingsTable.$inferSelect;

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function expertChannels(e: ExpertRow) {
  const out: Array<{ id: "messaging" | "calls"; platform?: string; priceUsdc: string }> = [];
  if (e.messagingEnabled) {
    out.push({
      id: "messaging",
      platform: e.messagingPlatform ?? "telegram",
      priceUsdc: e.messagingPriceUsdc ?? e.priceUsdc ?? "0",
    });
  }
  if (e.callsEnabled) {
    out.push({ id: "calls", priceUsdc: e.callsPriceUsdc ?? e.priceUsdc ?? "0" });
  }
  return out;
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

function mapAgentState(b: BookingRow): "awaiting_funding" | "funded" | "answered" | "released" | "refunded" | "expired" {
  if (b.status === "completed") return "released";
  if (b.status === "refunded") return "refunded";
  if (b.status === "awaiting_funding") {
    if (b.agentDeadline && b.agentDeadline.getTime() < Date.now()) return "expired";
    return "awaiting_funding";
  }
  if (b.status === "paid") {
    return b.agentAnswerText ? "answered" : "funded";
  }
  return "awaiting_funding";
}

function serializeAskStatus(b: BookingRow) {
  return {
    escrowId: b.escrowBookingId,
    state: mapAgentState(b),
    expertHandle: b.expertHandle,
    expertWallet: b.expertWallet,
    buyerWallet: b.buyerWallet,
    channelId: b.channel,
    amountUsdc: b.amountUsdc,
    feeUsdc: b.feeUsdc,
    question: b.agentQuestion,
    answer: b.agentAnswerText
      ? { text: b.agentAnswerText, links: parseLinks(b.agentAnswerLinks) }
      : null,
    txHashes: {
      book: b.bookTxHash && !b.bookTxHash.startsWith("pending-") ? b.bookTxHash : null,
      release: b.releaseTxHash,
      refund: b.refundTxHash,
    },
    createdAt: b.createdAt.toISOString(),
    deadline: b.agentDeadline ? b.agentDeadline.toISOString() : null,
  };
}

// --------------------------------------------------------------------------
// GET /v1/experts — public, agent-readable registry
// --------------------------------------------------------------------------

const ListExpertsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/v1/experts", async (req, res) => {
  const { limit, offset } = ListExpertsQuery.parse(req.query);
  const rows = await db
    .select()
    .from(expertsTable)
    .orderBy(desc(expertsTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Average response time = avg(completedAt - createdAt) over completed agent
  // bookings, per expert handle. Computed in one query for all listed experts.
  const handles = rows.map((r) => r.handle);
  const avgByHandle = new Map<string, number>();
  if (handles.length > 0) {
    const agg = await db.execute<{ expert_handle: string; avg_seconds: string | null }>(sql`
      SELECT expert_handle,
             EXTRACT(EPOCH FROM AVG(completed_at - created_at))::text AS avg_seconds
      FROM bookings
      WHERE source = 'agent'
        AND status = 'completed'
        AND completed_at IS NOT NULL
        AND expert_handle IN (${sql.join(handles.map((h) => sql`${h}`), sql`, `)})
      GROUP BY expert_handle
    `);
    const aggRows = (agg as unknown as { rows?: Array<{ expert_handle: string; avg_seconds: string | null }> }).rows
      ?? (agg as unknown as Array<{ expert_handle: string; avg_seconds: string | null }>);
    for (const r of aggRows ?? []) {
      if (r.avg_seconds != null) avgByHandle.set(r.expert_handle, Math.round(Number(r.avg_seconds)));
    }
  }

  const experts = rows
    .filter((e) => e.messagingEnabled || e.callsEnabled)
    .map((e) => ({
      handle: e.handle,
      wallet: e.wallet,
      basename: e.basename,
      name: e.name,
      about: e.about ?? e.expertise ?? e.bio ?? "",
      categoryTags: parseTags(e.categoryTags),
      avgResponseTimeSeconds: avgByHandle.get(e.handle) ?? null,
      avatarUrl: e.avatarUrl,
      linkedinUrl: e.linkedinUrl,
      xUrl: e.xUrl,
      channels: expertChannels(e),
    }));
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json({
    chain: {
      id: getChainId(),
      name: getChainName(),
      escrowContract: getEscrowAddress(),
      tokenContract: getUsdcAddress(),
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      platformFeeBps: getPlatformFeeBps(),
      refundDelaySeconds: getRefundDelaySeconds(),
    },
    experts,
    pagination: { limit, offset, count: experts.length },
  });
});

// --------------------------------------------------------------------------
// GET /v1/experts/:handle — agent-readable single-expert detail
//
// Agents that discover an expert through a profile URL (e.g. linky.so/alex
// shared on X or LinkedIn) can fetch the machine-readable record at
// /api/v1/experts/<handle> and then call POST /v1/ask directly.
// --------------------------------------------------------------------------

async function avgResponseSecondsFor(handle: string): Promise<number | null> {
  const agg = await db.execute<{ avg_seconds: string | null }>(sql`
    SELECT EXTRACT(EPOCH FROM AVG(completed_at - created_at))::text AS avg_seconds
    FROM bookings
    WHERE source = 'agent'
      AND status = 'completed'
      AND completed_at IS NOT NULL
      AND expert_handle = ${handle}
  `);
  const rows = (agg as unknown as { rows?: Array<{ avg_seconds: string | null }> }).rows
    ?? (agg as unknown as Array<{ avg_seconds: string | null }>);
  const v = rows?.[0]?.avg_seconds;
  return v == null ? null : Math.round(Number(v));
}

router.get("/v1/experts/:handle", async (req, res) => {
  const handle = String(req.params.handle ?? "").toLowerCase();
  if (!handle) {
    return res.status(400).json({ error: "Invalid handle", code: "invalid_handle" });
  }
  const [e] = await db
    .select()
    .from(expertsTable)
    .where(eq(expertsTable.handle, handle))
    .limit(1);
  if (!e || (!e.messagingEnabled && !e.callsEnabled)) {
    return res.status(404).json({ error: "Expert not found", code: "expert_not_found" });
  }
  const avg = await avgResponseSecondsFor(e.handle);
  res.setHeader("Cache-Control", "public, max-age=30");
  return res.json({
    chain: {
      id: getChainId(),
      name: getChainName(),
      escrowContract: getEscrowAddress(),
      tokenContract: getUsdcAddress(),
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      platformFeeBps: getPlatformFeeBps(),
      refundDelaySeconds: getRefundDelaySeconds(),
    },
    expert: {
      handle: e.handle,
      wallet: e.wallet,
      basename: e.basename,
      name: e.name,
      about: e.about ?? e.expertise ?? e.bio ?? "",
      categoryTags: parseTags(e.categoryTags),
      avgResponseTimeSeconds: avg,
      avatarUrl: e.avatarUrl,
      linkedinUrl: e.linkedinUrl,
      xUrl: e.xUrl,
      channels: expertChannels(e),
    },
    askEndpoint: "/api/v1/ask",
    docsUrl: "/docs/agents",
  });
});

// --------------------------------------------------------------------------
// POST /v1/ask — create a draft booking for an agent
// --------------------------------------------------------------------------

const AskBody = z.object({
  expertHandle: z.string().min(1),
  channelId: z.enum(["messaging", "calls"]),
  question: z.string().min(1).max(4000),
  callbackUrl: z.string().url().nullable().optional(),
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  timestamp: z.number().int(),
});

router.post("/v1/ask", async (req, res) => {
  const body = AskBody.parse(req.body);
  const wallet = body.wallet.toLowerCase();

  // SSRF guard runs first so the validator is exercised even when escrow is
  // unconfigured. The webhook worker will fetch this URL with retries up to
  // ~24h, so we require https and reject private/loopback/metadata targets.
  if (body.callbackUrl) {
    const check = await validateWebhookUrl(body.callbackUrl);
    if (!check.ok) {
      return res.status(400).json({ error: check.reason, code: "invalid_callback_url" });
    }
  }

  const escrowAddress = getEscrowAddress();
  if (!escrowAddress) {
    return res.status(503).json({ error: "Escrow contract not configured", code: "escrow_unavailable" });
  }

  // Wallet-signed proof of intent. We bind every mutable field of the ask
  // into the resource so a captured signature can't be replayed against a
  // different question, channel, or callback target. The signed message is:
  //   LINKY:<chainId>:agent-ask:<expertHandle>:<channelId>:<askHash>:<timestamp>
  // where askHash = sha256("<question>\n<callbackUrl ?? ''>").
  const askHash = crypto
    .createHash("sha256")
    .update(`${body.question}\n${body.callbackUrl ?? ""}`)
    .digest("hex");
  const sig = await verifySignedMessage({
    action: "agent-ask",
    resource: `${body.expertHandle}:${body.channelId}:${askHash}`,
    wallet,
    signature: body.signature,
    timestamp: body.timestamp,
  });
  if (!sig.ok) return res.status(sig.status).json({ error: sig.error, code: "bad_signature" });

  const [expert] = await db
    .select()
    .from(expertsTable)
    .where(eq(expertsTable.handle, body.expertHandle))
    .limit(1);
  if (!expert) return res.status(404).json({ error: "Expert not found", code: "expert_not_found" });

  const channelEnabled =
    body.channelId === "messaging" ? expert.messagingEnabled : expert.callsEnabled;
  if (!channelEnabled) {
    return res
      .status(400)
      .json({ error: `Expert has not enabled ${body.channelId}`, code: "channel_disabled" });
  }

  const priceStr =
    body.channelId === "messaging"
      ? expert.messagingPriceUsdc ?? expert.priceUsdc
      : expert.callsPriceUsdc ?? expert.priceUsdc;
  if (!priceStr) {
    return res.status(400).json({ error: "Channel has no price configured", code: "no_price" });
  }
  let amount: bigint;
  try {
    amount = parseUnits(priceStr, 6);
  } catch {
    return res.status(400).json({ error: "Channel has an invalid price", code: "invalid_price" });
  }
  if (amount <= 0n) {
    return res.status(400).json({ error: "Channel price must be positive", code: "invalid_price" });
  }

  // Issue a fresh on-chain booking id and a per-booking webhook signing secret.
  const escrowId = `0x${crypto.randomBytes(32).toString("hex")}`;
  const webhookSecret = crypto.randomBytes(32).toString("hex");
  const fee = (amount * BigInt(getPlatformFeeBps())) / 10_000n;
  const amountUsdc = (Number(amount) / 1_000_000).toFixed(6);
  const feeUsdc = (Number(fee) / 1_000_000).toFixed(6);
  const deadlineSec = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  // bookTxHash is NOT NULL UNIQUE in the schema, so we drop in a placeholder
  // until the agent actually funds the escrow on-chain.
  const placeholderTx = `pending-${escrowId.slice(2, 18)}-${crypto.randomBytes(4).toString("hex")}`;

  const [created] = await db
    .insert(bookingsTable)
    .values({
      expertHandle: expert.handle,
      expertWallet: expert.wallet,
      buyerWallet: wallet,
      amountUsdc,
      feeUsdc,
      escrowBookingId: escrowId,
      bookTxHash: placeholderTx,
      channel: body.channelId,
      status: "awaiting_funding",
      source: "agent",
      callbackUrl: body.callbackUrl ?? null,
      agentQuestion: body.question,
      webhookSecret,
      agentDeadline: new Date(deadlineSec * 1000),
    })
    .returning();

  return res.status(201).json({
    escrowId,
    state: "awaiting_funding",
    funding: {
      chainId: getChainId(),
      escrowContract: escrowAddress,
      tokenContract: getUsdcAddress(),
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      expertWallet: expert.wallet,
      amount: amount.toString(),
      amountUsdc,
      deadline: deadlineSec,
      method: "escrow.book(bytes32 id, address expert, uint256 amount)",
    },
    webhook: created!.callbackUrl
      ? {
          url: created!.callbackUrl,
          secret: webhookSecret,
          signatureHeader: "LINKY-Signature",
          signatureScheme: "t=<unix>,v1=<hex-hmac-sha256(secret, `${t}.${rawBody}`)>",
        }
      : null,
  });
});

// --------------------------------------------------------------------------
// GET /v1/ask/:escrowId — status + lazy on-chain verification of funding
// --------------------------------------------------------------------------

router.get("/v1/ask/:escrowId", async (req, res) => {
  const escrowId = String(req.params.escrowId ?? "").toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(escrowId)) {
    return res.status(400).json({ error: "Invalid escrowId", code: "invalid_escrow_id" });
  }
  const [row] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.escrowBookingId, escrowId))
    .limit(1);
  if (!row) return res.status(404).json({ error: "Not found", code: "not_found" });

  let booking = row;
  const txHash =
    typeof req.query.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(req.query.txHash)
      ? req.query.txHash.toLowerCase()
      : null;

  // Lazy funding verification: when the agent passes ?txHash=, look up the
  // on-chain Booked event and promote the row from awaiting_funding -> paid.
  if (txHash && booking.status === "awaiting_funding") {
    const booked = await extractBooked({
      txHash,
      bookingId: escrowId,
      expert: booking.expertWallet,
    });
    if (booked) {
      let expected: bigint | null = null;
      try {
        expected = parseUnits(booking.amountUsdc, 6);
      } catch {
        expected = null;
      }
      if (
        expected !== null &&
        booked.amount === expected &&
        booked.buyer.toLowerCase() === booking.buyerWallet.toLowerCase()
      ) {
        const [updated] = await db
          .update(bookingsTable)
          .set({ status: "paid", bookTxHash: txHash })
          .where(eq(bookingsTable.id, booking.id))
          .returning();
        booking = updated!;
        enqueueWebhook({ booking, event: "funded" });
      }
    }
  }

  return res.json(serializeAskStatus(booking));
});

// --------------------------------------------------------------------------
// POST /v1/answers/:escrowId — expert posts the answer for an agent booking
// --------------------------------------------------------------------------

const AnswerBody = z.object({
  text: z.string().min(1).max(8000),
  links: z.array(z.string().url()).max(20).optional(),
});

router.post("/v1/answers/:escrowId", requireAuth, async (req, res) => {
  const escrowId = String(req.params.escrowId ?? "").toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(escrowId)) {
    return res.status(400).json({ error: "Invalid escrowId", code: "invalid_escrow_id" });
  }
  const body = AnswerBody.parse(req.body);
  const wallet = req.wallet!;

  const [row] = await db
    .select()
    .from(bookingsTable)
    .where(
      and(eq(bookingsTable.escrowBookingId, escrowId), ne(bookingsTable.status, "refunded")),
    )
    .limit(1);
  if (!row) return res.status(404).json({ error: "Not found", code: "not_found" });
  if (row.expertWallet !== wallet) {
    return res.status(403).json({ error: "Only the expert can answer", code: "forbidden" });
  }
  if (row.source !== "agent") {
    return res.status(400).json({ error: "Not an agent booking", code: "not_agent_booking" });
  }
  if (row.status !== "paid") {
    return res
      .status(409)
      .json({ error: `Cannot answer a booking with status ${row.status}`, code: "bad_state" });
  }

  const [updated] = await db
    .update(bookingsTable)
    .set({
      agentAnswerText: body.text,
      agentAnswerLinks: JSON.stringify(body.links ?? []),
    })
    .where(eq(bookingsTable.id, row.id))
    .returning();

  enqueueWebhook({ booking: updated!, event: "answered" });

  return res.json(serializeAskStatus(updated!));
});

export default router;
