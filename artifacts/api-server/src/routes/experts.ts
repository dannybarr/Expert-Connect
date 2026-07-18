import { Router, type IRouter } from "express";
import { db, expertsTable, bookingsTable } from "@workspace/db";
import { eq, and, or, desc, sql } from "drizzle-orm";
import {
  ListExpertsQueryParams,
  ListExpertsResponse,
  CreateExpertBody,
  GetExpertParams,
  GetExpertResponse,
  GetExpertByWalletParams,
  GetExpertByWalletResponse,
  GetExpertStatsParams,
  GetExpertStatsResponse,
  RevealExpertContactParams,
  RevealExpertContactResponse,
} from "@workspace/api-zod";
import { verifySignedMessage } from "../lib/auth.js";
import { requireAuth } from "../lib/require-auth.js";

const router: IRouter = Router();

type ExpertRow = typeof expertsTable.$inferSelect;

// Build the public-safe serialization. No raw messaging handle or booking URL.
function serializeExpert(e: ExpertRow) {
  // Backfill bridge: legacy rows with a single accessType / priceUsdc still
  // need to render. If the row has no channel toggles set but does have a
  // legacy price + accessType, expose it as the corresponding channel(s)
  // with the legacy price.
  const messagingEnabled =
    e.messagingEnabled ||
    (!e.messagingEnabled && !e.callsEnabled && e.accessType === "chat") ||
    (!e.messagingEnabled && !e.callsEnabled && e.accessType === "both");
  const callsEnabled =
    e.callsEnabled ||
    (!e.messagingEnabled && !e.callsEnabled && e.accessType === "booking_link") ||
    (!e.messagingEnabled && !e.callsEnabled && e.accessType === "both");

  const messaging = messagingEnabled
    ? {
        enabled: true,
        platform: (e.messagingPlatform ?? "telegram") as "whatsapp" | "telegram",
        priceUsdc: e.messagingPriceUsdc ?? e.priceUsdc ?? "0",
      }
    : null;

  const calls = callsEnabled
    ? {
        enabled: true,
        priceUsdc: e.callsPriceUsdc ?? e.priceUsdc ?? "0",
      }
    : null;

  return {
    id: e.id,
    handle: e.handle,
    wallet: e.wallet,
    name: e.name,
    about: e.about ?? e.expertise ?? e.bio ?? "",
    linkedinUrl: e.linkedinUrl,
    xUrl: e.xUrl,
    avatarUrl: e.avatarUrl,
    messaging,
    calls,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/experts", async (req, res) => {
  const { limit } = ListExpertsQueryParams.parse(req.query);
  const rows = await db
    .select()
    .from(expertsTable)
    .orderBy(desc(expertsTable.createdAt))
    .limit(limit);
  res.json(ListExpertsResponse.parse(rows.map(serializeExpert)));
});

router.post("/experts", async (req, res) => {
  const body = CreateExpertBody.parse(req.body);
  const wallet = body.wallet.toLowerCase();

  const sig = await verifySignedMessage({
    action: "create-expert",
    resource: body.handle,
    wallet,
    signature: body.signature,
    timestamp: body.timestamp,
  });
  if (!sig.ok) return res.status(sig.status).json({ error: sig.error });

  // Per-channel validation: at least one channel must be fully specified.
  const m = body.messaging;
  const c = body.calls;
  const messagingOk =
    !!m?.enabled && !!m?.platform && !!m?.handle?.trim() && !!m?.priceUsdc?.trim();
  const callsOk = !!c?.enabled && !!c?.bookingUrl?.trim() && !!c?.priceUsdc?.trim();
  if (!messagingOk && !callsOk) {
    return res.status(400).json({ error: "Enable at least one channel (messaging or calls)" });
  }
  if (m?.enabled && !messagingOk) {
    return res.status(400).json({ error: "Messaging needs a platform, handle, and price" });
  }
  if (c?.enabled && !callsOk) {
    return res.status(400).json({ error: "Calls needs a booking URL and a price" });
  }

  const [existingHandle] = await db
    .select()
    .from(expertsTable)
    .where(eq(expertsTable.handle, body.handle))
    .limit(1);
  if (existingHandle) return res.status(409).json({ error: "Handle already taken" });

  const [existingWallet] = await db
    .select()
    .from(expertsTable)
    .where(eq(expertsTable.wallet, wallet))
    .limit(1);
  if (existingWallet) return res.status(409).json({ error: "Wallet already has a profile" });

  const [created] = await db
    .insert(expertsTable)
    .values({
      handle: body.handle,
      wallet,
      name: body.name,
      bio: body.about, // mirror about into bio so the legacy not-null column has a value
      about: body.about,
      linkedinUrl: body.linkedinUrl ?? null,
      xUrl: body.xUrl ?? null,
      avatarUrl: body.avatarUrl ?? null,
      messagingEnabled: messagingOk,
      messagingPlatform: messagingOk ? m!.platform! : null,
      messagingHandle: messagingOk ? m!.handle!.trim() : null,
      messagingPriceUsdc: messagingOk ? m!.priceUsdc! : null,
      callsEnabled: callsOk,
      callsBookingUrl: callsOk ? c!.bookingUrl!.trim() : null,
      callsPriceUsdc: callsOk ? c!.priceUsdc! : null,
    })
    .returning();

  return res.status(201).json(GetExpertResponse.parse(serializeExpert(created!)));
});

router.get("/experts/by-wallet/:wallet", async (req, res) => {
  const { wallet } = GetExpertByWalletParams.parse(req.params);
  const [row] = await db
    .select()
    .from(expertsTable)
    .where(eq(expertsTable.wallet, wallet.toLowerCase()))
    .limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(GetExpertByWalletResponse.parse(serializeExpert(row)));
});

router.get("/experts/:handle", async (req, res) => {
  const { handle } = GetExpertParams.parse(req.params);
  const [row] = await db
    .select()
    .from(expertsTable)
    .where(eq(expertsTable.handle, handle))
    .limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(GetExpertResponse.parse(serializeExpert(row)));
});

router.get("/experts/:handle/stats", async (req, res) => {
  const { handle } = GetExpertStatsParams.parse(req.params);
  const [expert] = await db
    .select()
    .from(expertsTable)
    .where(eq(expertsTable.handle, handle))
    .limit(1);
  if (!expert) return res.status(404).json({ error: "Not found" });

  const [stats] = await db
    .select({
      totalEarnedUsdc: sql<string>`COALESCE(SUM(${bookingsTable.amountUsdc} - ${bookingsTable.feeUsdc}) FILTER (WHERE ${bookingsTable.status} = 'completed'), 0)::text`,
      totalBookings: sql<number>`COUNT(*)::int`,
      completedBookings: sql<number>`COUNT(*) FILTER (WHERE ${bookingsTable.status} = 'completed')::int`,
      messagingBookings: sql<number>`COUNT(*) FILTER (WHERE ${bookingsTable.channel} = 'messaging')::int`,
      callsBookings: sql<number>`COUNT(*) FILTER (WHERE ${bookingsTable.channel} = 'calls')::int`,
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.expertHandle, handle));

  return res.json(
    GetExpertStatsResponse.parse({
      handle,
      totalEarnedUsdc: stats?.totalEarnedUsdc ?? "0",
      totalBookings: stats?.totalBookings ?? 0,
      completedBookings: stats?.completedBookings ?? 0,
      messagingBookings: stats?.messagingBookings ?? 0,
      callsBookings: stats?.callsBookings ?? 0,
    }),
  );
});

// Auth-gated reveal — only the buyer who paid for this channel may see contact.
router.get("/experts/:handle/reveal/:channel", requireAuth, async (req, res) => {
  const { handle, channel } = RevealExpertContactParams.parse(req.params);
  const wallet = req.wallet!;

  const [expert] = await db
    .select()
    .from(expertsTable)
    .where(eq(expertsTable.handle, handle))
    .limit(1);
  if (!expert) return res.status(404).json({ error: "Not found" });

  // Require ANY paid/completed booking for this (expert, buyer, channel).
  // Filter status in SQL so an earlier refunded booking can't shadow a later
  // legitimate one.
  const [booking] = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.expertHandle, handle),
        eq(bookingsTable.buyerWallet, wallet),
        eq(bookingsTable.channel, channel),
        or(eq(bookingsTable.status, "paid"), eq(bookingsTable.status, "completed")),
      ),
    )
    .limit(1);
  if (!booking) {
    return res.status(403).json({ error: "No paid booking for this channel" });
  }

  if (channel === "messaging") {
    if (!expert.messagingEnabled || !expert.messagingHandle) {
      return res.status(404).json({ error: "Channel disabled" });
    }
    return res.json(
      RevealExpertContactResponse.parse({
        channel,
        platform: (expert.messagingPlatform ?? "telegram") as "whatsapp" | "telegram",
        handle: expert.messagingHandle,
        bookingUrl: null,
      }),
    );
  }

  // calls
  const url = expert.callsBookingUrl ?? expert.bookingUrl;
  if (!url) return res.status(404).json({ error: "Channel disabled" });
  return res.json(
    RevealExpertContactResponse.parse({
      channel,
      platform: null,
      handle: null,
      bookingUrl: url,
    }),
  );
});

export default router;
