import { pgTable, text, timestamp, uuid, numeric, boolean } from "drizzle-orm/pg-core";

export const expertsTable = pgTable("experts", {
  id: uuid("id").primaryKey().defaultRandom(),
  handle: text("handle").notNull().unique(),
  wallet: text("wallet").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio").notNull(),
  // Deprecated. Kept nullable for legacy rows; new rows use `about`.
  expertise: text("expertise"),
  // Profile profession / one-liner ("about me").
  about: text("about"),
  linkedinUrl: text("linkedin_url"),
  xUrl: text("x_url"),
  // Legacy single-price / access-type columns. Kept nullable so old rows still load.
  priceUsdc: numeric("price_usdc", { precision: 18, scale: 6 }),
  accessType: text("access_type"),
  bookingUrl: text("booking_url"),
  avatarUrl: text("avatar_url"),

  // ENS / Base name resolved for the expert wallet (e.g. "alice.base.eth"). Nullable.
  basename: text("basename"),
  // JSON-encoded string array of category tags (e.g. ["defi","tax"]). Nullable.
  categoryTags: text("category_tags"),

  // Messaging channel (WhatsApp / Telegram).
  messagingEnabled: boolean("messaging_enabled").notNull().default(false),
  messagingPlatform: text("messaging_platform"), // 'whatsapp' | 'telegram'
  messagingHandle: text("messaging_handle"),
  messagingPriceUsdc: numeric("messaging_price_usdc", { precision: 18, scale: 6 }),

  // Calls channel (Cal.com / Calendly / etc).
  callsEnabled: boolean("calls_enabled").notNull().default(false),
  callsBookingUrl: text("calls_booking_url"),
  callsPriceUsdc: numeric("calls_price_usdc", { precision: 18, scale: 6 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Expert = typeof expertsTable.$inferSelect;
export type InsertExpert = typeof expertsTable.$inferInsert;
