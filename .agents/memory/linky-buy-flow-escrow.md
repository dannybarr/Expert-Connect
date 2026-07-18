---
name: LINKY buy flow — escrow vs direct transfer
description: Why two payment paths coexist in LINKY (web direct-transfer vs escrow), so escrow code is not mistaken for dead code.
---

# LINKY has two payment paths — do not delete the escrow code

The **web buyer flow** (`expert-profile-content.tsx` → `pay-sheet.tsx`) is **escrow-free** and
pays the seller and platform in ONE batched transaction: buyer enters email → two USDC `transfer`
calls in a single tx (platform fee → treasury, remainder → expert wallet) → backend
`POST /bookings` verifies BOTH on-chain Transfers (`verifyUsdcSplitTransfer` in `auth.ts`) and
returns the contact `reveal` (also emailed best-effort via Resend). No approve, no escrow contract
on this path.

**Fee split must agree byte-for-byte between FE and BE.** `feeAmount = price * bps / 10000` using
integer BigInt division on BOTH sides; normalize bps identically (`Math.round`) in
`buildSplitTransferCalls` (frontend) and `bookings.ts` (backend), or the split the buyer signed
won't match what the server verifies and the booking 402s.

**Why:** product wants both the treasury fee AND the seller to receive funds; security/escrow were
deprioritized. Earlier iteration sent 100% to the expert with zero fee — that was replaced by the
split. The treasury address comes from the `TREASURY_ADDRESS` env var; if unset it falls back to a
`0x…dEaD` burn address, so the fee leg silently burns — always confirm TREASURY_ADDRESS is set.

**How to apply:** The escrow helpers (`buildBookCalls`/`buildReleaseCall`/`buildRefundCall` in
`escrow.ts`, and the escrow Booked-event verification) are **still used intentionally** by
`dashboard.tsx`, `booking.tsx`, and the agent API (`v1.ts`). Do NOT "clean up" escrow code as
dead — only the web buy path was migrated off escrow.

**Reveal must be returned on every create path.** `POST /bookings` returns `BookingWithReveal`
(`reveal` + `emailSent`) on the 201 create AND on all idempotent 200 duplicate paths
(by escrowBookingId, by bookTxHash, and 23505 recovery). If a duplicate path returns a booking
without `reveal`, a retried payment silently fails to unlock the contact in-app.
