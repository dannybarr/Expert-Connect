import { Router, type IRouter } from "express";
import { db, expertsTable, bookingsTable } from "@workspace/db";
import { eq, desc, and, ne } from "drizzle-orm";
import { enqueueWebhook } from "../lib/webhooks.js";
import { parseUnits } from "viem";
import {
  CreateBookingBody,
  GetBookingParams,
  GetBookingResponse,
  CompleteBookingParams,
  CompleteBookingBody,
  CompleteBookingResponse,
  RefundBookingParams,
  RefundBookingBody,
  RefundBookingResponse,
  ListBookingsByExpertParams,
  ListBookingsByExpertResponse,
  ListBookingsByBuyerParams,
  ListBookingsByBuyerResponse,
} from "@workspace/api-zod";
import {
  verifyReleased,
  verifyRefunded,
  verifyUsdcSplitTransfer,
  getRefundDelaySeconds,
  getPlatformFeeBps,
  getTreasuryAddress,
} from "../lib/auth.js";
import { sendContactEmail } from "../lib/email.js";
import { requireAuth } from "../lib/require-auth.js";

type RevealContact = {
  channel: "messaging" | "calls";
  platform: "whatsapp" | "telegram" | null;
  handle: string | null;
  bookingUrl: string | null;
};

function buildReveal(
  expert: typeof expertsTable.$inferSelect,
  channel: "messaging" | "calls",
): RevealContact {
  if (channel === "messaging") {
    return {
      channel,
      platform: (expert.messagingPlatform as "whatsapp" | "telegram" | null) ?? null,
      handle: expert.messagingHandle ?? null,
      bookingUrl: null,
    };
  }
  return {
    channel,
    platform: null,
    handle: null,
    bookingUrl: expert.callsBookingUrl ?? expert.bookingUrl ?? null,
  };
}

const router: IRouter = Router();

function serializeBooking(b: typeof bookingsTable.$inferSelect) {
  // Map legacy rows (no channel set) onto a channel for forwards compatibility.
  // 'chat' / 'both' → messaging; 'booking_link' → calls.
  const channel: "messaging" | "calls" =
    (b.channel as "messaging" | "calls" | null) ??
    (b.accessType === "booking_link" ? "calls" : "messaging");
  return {
    id: b.id,
    expertHandle: b.expertHandle,
    expertWallet: b.expertWallet,
    buyerWallet: b.buyerWallet,
    buyerEmail: b.buyerEmail ?? null,
    amountUsdc: b.amountUsdc,
    feeUsdc: b.feeUsdc,
    escrowBookingId: b.escrowBookingId,
    bookTxHash: b.bookTxHash,
    releaseTxHash: b.releaseTxHash,
    refundTxHash: b.refundTxHash,
    status: b.status as "paid" | "completed" | "refunded",
    channel,
    source: (b.source as "web" | "agent" | null) ?? null,
    createdAt: b.createdAt.toISOString(),
    completedAt: b.completedAt ? b.completedAt.toISOString() : null,
    releasedAt: b.releasedAt ? b.releasedAt.toISOString() : null,
    refundedAt: b.refundedAt ? b.refundedAt.toISOString() : null,
  };
}

router.post("/bookings", async (req, res) => {
  const body = CreateBookingBody.parse(req.body);
  const escrowBookingId = body.escrowBookingId.toLowerCase();
  const bookTxHash = body.bookTxHash.toLowerCase();
  const channel = body.channel;

  const [expert] = await db
    .select()
    .from(expertsTable)
    .where(eq(expertsTable.handle, body.expertHandle))
    .limit(1);
  if (!expert) return res.status(404).json({ error: "Expert not found" });

  if (channel === "messaging" && !expert.messagingEnabled) {
    return res.status(400).json({ error: "Expert has not enabled messaging" });
  }
  if (channel === "calls" && !expert.callsEnabled) {
    return res.status(400).json({ error: "Expert has not enabled calls" });
  }

  // Channel<>price binding: the on-chain `amount` MUST match the seller's
  // current price for the channel the buyer claims. Otherwise a buyer could
  // pay the messaging price and unlock the (more expensive) calls channel.
  const channelPriceUsdc =
    channel === "messaging"
      ? expert.messagingPriceUsdc ?? expert.priceUsdc
      : expert.callsPriceUsdc ?? expert.priceUsdc;
  if (!channelPriceUsdc) {
    return res.status(400).json({ error: "Channel has no price configured" });
  }
  let expectedAmount: bigint;
  try {
    expectedAmount = parseUnits(channelPriceUsdc, 6);
  } catch {
    return res.status(400).json({ error: "Channel has an invalid price" });
  }

  // Reveal is returned on every success path (fresh create AND idempotent
  // duplicates) so the buyer unlocks instantly even if the request is retried.
  const reveal = buildReveal(expert, channel);

  // A duplicate (already-recorded) booking still returns the reveal so a retry
  // unlocks the contact. We do not re-send the email on duplicates.
  function respondExisting(row: typeof bookingsTable.$inferSelect) {
    return res
      .status(200)
      .json({ ...GetBookingResponse.parse(serializeBooking(row)), reveal, emailSent: false });
  }

  const [byId] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.escrowBookingId, escrowBookingId))
    .limit(1);
  if (byId) return respondExisting(byId);
  const [byTx] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.bookTxHash, bookTxHash))
    .limit(1);
  if (byTx) return respondExisting(byTx);

  // No escrow: the buyer pays the listed price in USDC, split in one tx into a
  // platform fee to the treasury and the remainder to the expert. Verify the
  // transaction contains both matching ERC-20 Transfers. The buyer wallet is
  // the `from` address of the expert leg.
  const treasury = getTreasuryAddress();
  // Normalize bps with Math.round to stay byte-for-byte identical to the
  // frontend's fee math (buildSplitTransferCalls), so the on-chain split the
  // buyer signed always matches what we verify here.
  const feeAmount = (expectedAmount * BigInt(Math.round(getPlatformFeeBps()))) / 10000n;
  const expertAmount = expectedAmount - feeAmount;
  const v = await verifyUsdcSplitTransfer({
    txHash: bookTxHash,
    expert: expert.wallet,
    treasury,
    expertAmount,
    feeAmount,
  });
  if (!v.ok) return res.status(v.status).json({ error: v.error });
  const { buyer } = v;

  // amountUsdc is the full price the buyer paid; feeUsdc is the platform's cut,
  // so the seller's net payout is amountUsdc - feeUsdc.
  const amountUsdc = (Number(expectedAmount) / 1_000_000).toFixed(6);
  const feeUsdc = (Number(feeAmount) / 1_000_000).toFixed(6);

  async function respondCreated(row: typeof bookingsTable.$inferSelect) {
    const emailSent = row.buyerEmail
      ? await sendContactEmail({ to: row.buyerEmail, expertName: expert.name, contact: reveal })
      : false;
    return res
      .status(201)
      .json({ ...GetBookingResponse.parse(serializeBooking(row)), reveal, emailSent });
  }

  try {
    const [created] = await db
      .insert(bookingsTable)
      .values({
        expertHandle: expert.handle,
        expertWallet: expert.wallet,
        buyerWallet: buyer,
        buyerEmail: body.email,
        amountUsdc,
        feeUsdc,
        escrowBookingId,
        bookTxHash,
        channel,
        status: "paid",
      })
      .returning();
    return await respondCreated(created!);
  } catch (err) {
    const code = (err as { code?: string; cause?: { code?: string } }).code
      ?? (err as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") {
      const [existing] = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.escrowBookingId, escrowBookingId))
        .limit(1);
      if (existing) return respondExisting(existing);
      const [existingByTx] = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.bookTxHash, bookTxHash))
        .limit(1);
      if (existingByTx) return respondExisting(existingByTx);
    }
    throw err;
  }
});

router.get("/bookings/:id", requireAuth, async (req, res) => {
  const { id } = GetBookingParams.parse(req.params);
  const wallet = req.wallet!;
  const [row] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.buyerWallet !== wallet && row.expertWallet !== wallet) {
    return res.status(403).json({ error: "Not a participant on this booking" });
  }
  return res.json(GetBookingResponse.parse(serializeBooking(row)));
});

router.post("/bookings/:id/complete", requireAuth, async (req, res) => {
  const { id } = CompleteBookingParams.parse(req.params);
  const body = CompleteBookingBody.parse(req.body);
  const wallet = req.wallet!;
  const releaseTxHash = body.releaseTxHash.toLowerCase();

  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.expertWallet !== wallet) {
    return res.status(403).json({ error: "Only the expert can complete a booking" });
  }
  if (existing.status === "completed") {
    return res.json(CompleteBookingResponse.parse(serializeBooking(existing)));
  }
  if (existing.status !== "paid") {
    return res.status(409).json({ error: `Cannot complete a booking with status ${existing.status}` });
  }

  const v = await verifyReleased({
    txHash: releaseTxHash,
    bookingId: existing.escrowBookingId,
    expert: existing.expertWallet,
  });
  if (!v.ok) return res.status(v.status).json({ error: v.error });

  const now = new Date();
  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "completed", completedAt: now, releasedAt: now, releaseTxHash })
    .where(eq(bookingsTable.id, id))
    .returning();
  if (updated && updated.source === "agent") {
    await enqueueWebhook({ booking: updated, event: "released" });
  }
  return res.json(CompleteBookingResponse.parse(serializeBooking(updated!)));
});

router.post("/bookings/:id/refund", requireAuth, async (req, res) => {
  const { id } = RefundBookingParams.parse(req.params);
  const body = RefundBookingBody.parse(req.body);
  const wallet = req.wallet!;
  const refundTxHash = body.refundTxHash.toLowerCase();

  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.buyerWallet !== wallet) {
    return res.status(403).json({ error: "Only the buyer can refund a booking" });
  }
  if (existing.status === "refunded") {
    return res.json(RefundBookingResponse.parse(serializeBooking(existing)));
  }
  if (existing.status !== "paid") {
    return res.status(409).json({ error: `Cannot refund a booking with status ${existing.status}` });
  }
  const ageSec = (Date.now() - existing.createdAt.getTime()) / 1000;
  if (ageSec < getRefundDelaySeconds()) {
    return res.status(409).json({ error: "Refund delay has not elapsed yet" });
  }

  const v = await verifyRefunded({
    txHash: refundTxHash,
    bookingId: existing.escrowBookingId,
    buyer: existing.buyerWallet,
  });
  if (!v.ok) return res.status(v.status).json({ error: v.error });

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "refunded", refundedAt: new Date(), refundTxHash })
    .where(eq(bookingsTable.id, id))
    .returning();
  if (updated && updated.source === "agent") {
    await enqueueWebhook({ booking: updated, event: "refunded" });
  }
  return res.json(RefundBookingResponse.parse(serializeBooking(updated!)));
});

router.get("/bookings/by-expert/:wallet", requireAuth, async (req, res) => {
  const { wallet } = ListBookingsByExpertParams.parse(req.params);
  const target = wallet.toLowerCase();
  if (target !== req.wallet) {
    return res.status(403).json({ error: "Wallet does not match session" });
  }
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(
      and(eq(bookingsTable.expertWallet, target), ne(bookingsTable.status, "awaiting_funding")),
    )
    .orderBy(desc(bookingsTable.createdAt));
  return res.json(ListBookingsByExpertResponse.parse(rows.map(serializeBooking)));
});

router.get("/bookings/by-buyer/:wallet", requireAuth, async (req, res) => {
  const { wallet } = ListBookingsByBuyerParams.parse(req.params);
  const target = wallet.toLowerCase();
  if (target !== req.wallet) {
    return res.status(403).json({ error: "Wallet does not match session" });
  }
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(
      and(eq(bookingsTable.buyerWallet, target), ne(bookingsTable.status, "awaiting_funding")),
    )
    .orderBy(desc(bookingsTable.createdAt));
  return res.json(ListBookingsByBuyerResponse.parse(rows.map(serializeBooking)));
});

export default router;
