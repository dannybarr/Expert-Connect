import { Router, type IRouter } from "express";
import { db, expertsTable, bookingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { GetPlatformStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats/platform", async (_req, res) => {
  const [bookingStats] = await db
    .select({
      totalVolumeUsdc: sql<string>`COALESCE(SUM(${bookingsTable.amountUsdc}), 0)::text`,
      totalBookings: sql<number>`COUNT(*) FILTER (WHERE ${bookingsTable.status} IN ('paid', 'completed'))::int`,
    })
    .from(bookingsTable);
  const [expertStats] = await db
    .select({
      totalExperts: sql<number>`COUNT(*)::int`,
      totalLinks: sql<number>`(
        SUM(CASE WHEN ${expertsTable.messagingEnabled} THEN 1 ELSE 0 END) +
        SUM(CASE WHEN ${expertsTable.callsEnabled} THEN 1 ELSE 0 END)
      )::int`,
    })
    .from(expertsTable);

  res.json(
    GetPlatformStatsResponse.parse({
      totalVolumeUsdc: bookingStats?.totalVolumeUsdc ?? "0",
      totalBookings: bookingStats?.totalBookings ?? 0,
      totalExperts: expertStats?.totalExperts ?? 0,
      totalLinks: expertStats?.totalLinks ?? 0,
    }),
  );
});

export default router;
