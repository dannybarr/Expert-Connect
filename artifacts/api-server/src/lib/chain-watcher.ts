import {
  createPublicClient,
  http,
  parseAbiItem,
  type Hex,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { eq, and, inArray, lt, isNotNull } from "drizzle-orm";
import { db, bookingsTable } from "@workspace/db";
import { parseUnits } from "viem";
import { getEscrowAddress } from "./auth.js";
import { enqueueWebhook } from "./webhooks.js";
import { logger } from "./logger.js";

function chain() {
  const which = (process.env.BASE_CHAIN ?? "base-sepolia").toLowerCase();
  return which === "base" || which === "mainnet" ? base : baseSepolia;
}

const publicClient = createPublicClient({
  chain: chain(),
  transport: http(process.env.BASE_RPC_URL || chain().rpcUrls.default.http[0]),
});

const bookedEvent = parseAbiItem(
  "event Booked(bytes32 indexed id, address indexed buyer, address indexed expert, uint256 amount)",
);
const releasedEvent = parseAbiItem(
  "event Released(bytes32 indexed id, address indexed expert, uint256 expertAmount, uint256 feeAmount)",
);
const refundedEvent = parseAbiItem(
  "event Refunded(bytes32 indexed id, address indexed buyer, uint256 amount)",
);

const TICK_MS = 30_000;
// Base produces ~2s blocks → look back ~1 day at most per scan.
const LOOKBACK_BLOCKS = 50_000n;

type Booking = typeof bookingsTable.$inferSelect;

async function scanFunding(b: Booking, escrow: string, fromBlock: bigint): Promise<void> {
  let expected: bigint;
  try {
    expected = parseUnits(b.amountUsdc, 6);
  } catch {
    return;
  }
  const logs = await publicClient.getLogs({
    address: escrow as Hex,
    event: bookedEvent,
    args: { id: b.escrowBookingId as Hex },
    fromBlock,
    toBlock: "latest",
  });
  for (const log of logs) {
    const args = (log as unknown as { args: { id: string; buyer: string; expert: string; amount: bigint } }).args;
    if (
      args.expert.toLowerCase() !== b.expertWallet.toLowerCase() ||
      args.buyer.toLowerCase() !== b.buyerWallet.toLowerCase() ||
      args.amount !== expected
    ) {
      continue;
    }
    const txHash = (log as unknown as { transactionHash: string }).transactionHash;
    const [updated] = await db
      .update(bookingsTable)
      .set({ status: "paid", bookTxHash: txHash })
      .where(and(eq(bookingsTable.id, b.id), eq(bookingsTable.status, "awaiting_funding")))
      .returning();
    if (updated) {
      logger.info({ escrowId: b.escrowBookingId, txHash }, "Agent booking auto-funded from chain event");
      await enqueueWebhook({ booking: updated, event: "funded" });
    }
    return;
  }
}

async function scanRelease(b: Booking, escrow: string, fromBlock: bigint): Promise<void> {
  const logs = await publicClient.getLogs({
    address: escrow as Hex,
    event: releasedEvent,
    args: { id: b.escrowBookingId as Hex },
    fromBlock,
    toBlock: "latest",
  });
  if (logs.length === 0) return;
  const txHash = (logs[0] as unknown as { transactionHash: string }).transactionHash;
  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "completed", releaseTxHash: txHash, releasedAt: new Date(), completedAt: new Date() })
    .where(and(eq(bookingsTable.id, b.id), eq(bookingsTable.status, "paid")))
    .returning();
  if (updated) {
    logger.info({ escrowId: b.escrowBookingId, txHash }, "Agent booking auto-released from chain event");
    await enqueueWebhook({ booking: updated, event: "released" });
  }
}

async function scanRefund(b: Booking, escrow: string, fromBlock: bigint): Promise<void> {
  const logs = await publicClient.getLogs({
    address: escrow as Hex,
    event: refundedEvent,
    args: { id: b.escrowBookingId as Hex },
    fromBlock,
    toBlock: "latest",
  });
  if (logs.length === 0) return;
  const txHash = (logs[0] as unknown as { transactionHash: string }).transactionHash;
  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "refunded", refundTxHash: txHash, refundedAt: new Date() })
    .where(and(eq(bookingsTable.id, b.id), inArray(bookingsTable.status, ["paid", "awaiting_funding"])))
    .returning();
  if (updated) {
    logger.info({ escrowId: b.escrowBookingId, txHash }, "Agent booking auto-refunded from chain event");
    await enqueueWebhook({ booking: updated, event: "refunded" });
  }
}

async function sweepExpired(): Promise<void> {
  // Any agent booking still in awaiting_funding past its deadline transitions
  // to refunded (the on-chain escrow is never funded) and gets a one-shot
  // "expired" webhook so the agent can stop polling.
  const overdue = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.source, "agent"),
        eq(bookingsTable.status, "awaiting_funding"),
        isNotNull(bookingsTable.agentDeadline),
        lt(bookingsTable.agentDeadline, new Date()),
      ),
    )
    .limit(100);
  for (const b of overdue) {
    const [updated] = await db
      .update(bookingsTable)
      .set({ status: "refunded", refundedAt: new Date() })
      .where(and(eq(bookingsTable.id, b.id), eq(bookingsTable.status, "awaiting_funding")))
      .returning();
    if (updated) {
      logger.info({ escrowId: b.escrowBookingId }, "Agent booking expired without funding");
      await enqueueWebhook({ booking: updated, event: "expired" });
    }
  }
}

async function tick(): Promise<void> {
  await sweepExpired();
  const escrow = getEscrowAddress();
  if (!escrow) return;
  const head = await publicClient.getBlockNumber();
  const fromBlock = head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n;

  const open = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.source, "agent"),
        inArray(bookingsTable.status, ["awaiting_funding", "paid"]),
      ),
    )
    .limit(200);

  for (const b of open) {
    try {
      if (b.status === "awaiting_funding") {
        await scanFunding(b, escrow, fromBlock);
      } else if (b.status === "paid") {
        await scanRelease(b, escrow, fromBlock);
        await scanRefund(b, escrow, fromBlock);
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message, escrowId: b.escrowBookingId }, "Chain scan failed for booking");
    }
  }
}

let started = false;
export function startChainWatcher(): void {
  if (started) return;
  started = true;
  const loop = async () => {
    try {
      await tick();
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Chain watcher tick failed");
    } finally {
      setTimeout(loop, TICK_MS).unref?.();
    }
  };
  setTimeout(loop, TICK_MS).unref?.();
  logger.info("Chain watcher started for agent bookings");
}
