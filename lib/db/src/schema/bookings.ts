import { pgTable, text, timestamp, uuid, numeric } from "drizzle-orm/pg-core";

export const bookingsTable = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  expertHandle: text("expert_handle").notNull(),
  expertWallet: text("expert_wallet").notNull(),
  buyerWallet: text("buyer_wallet").notNull(),
  // Email captured at checkout; contact is delivered here as well as in-app.
  buyerEmail: text("buyer_email"),
  amountUsdc: numeric("amount_usdc", { precision: 18, scale: 6 }).notNull(),
  feeUsdc: numeric("fee_usdc", { precision: 18, scale: 6 }).notNull(),
  // 32-byte hex (0x...) used as the booking id inside the escrow contract.
  escrowBookingId: text("escrow_booking_id").notNull().unique(),
  // On-chain receipts for each lifecycle transition.
  bookTxHash: text("book_tx_hash").notNull().unique(),
  releaseTxHash: text("release_tx_hash"),
  refundTxHash: text("refund_tx_hash"),
  // awaiting_funding | paid | completed | refunded
  status: text("status").notNull().default("paid"),
  // Which channel this booking unlocks: 'messaging' | 'calls'.
  // Nullable for backfill of legacy rows that predate per-channel pricing.
  channel: text("channel"),
  // Where the booking came from: 'web' (human via the LINKY site) or 'agent'
  // (programmatic via the /v1 Agent API). Nullable for legacy rows.
  source: text("source"),
  // Agent-API only fields. All null for human/web bookings.
  callbackUrl: text("callback_url"),
  agentQuestion: text("agent_question"),
  agentAnswerText: text("agent_answer_text"),
  // JSON-encoded string array of link URLs the expert attached to the answer.
  agentAnswerLinks: text("agent_answer_links"),
  webhookSecret: text("webhook_secret"),
  agentDeadline: timestamp("agent_deadline", { withTimezone: true }),
  // Deprecated. Kept for legacy rows.
  accessType: text("access_type"),
  bookingUrl: text("booking_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
});

export type Booking = typeof bookingsTable.$inferSelect;
export type InsertBooking = typeof bookingsTable.$inferInsert;
