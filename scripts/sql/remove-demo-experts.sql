-- Remove the three demo/seed experts that used to be inserted by the old
-- api-server seed routine (Ava Chen, Marco Velasco, Dr. Ines Park).
--
-- Keyed on their placeholder wallet addresses (all-1s / all-2s / all-3s), which
-- can never belong to a real person, so this can never delete a live profile.
--
-- Run this ONCE against the live Postgres if those demo rows were already
-- inserted before the seed code was removed. If your Replit deploy uses a fresh
-- database, there is nothing to clean and this is a no-op.
--
--   Replit: open the Database pane -> SQL runner, paste, run.
--   CLI:    psql "$DATABASE_URL" -f scripts/sql/remove-demo-experts.sql

DELETE FROM experts
WHERE wallet IN (
  '0x1111111111111111111111111111111111111111',
  '0x2222222222222222222222222222222222222222',
  '0x3333333333333333333333333333333333333333'
);
