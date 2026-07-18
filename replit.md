# LINKY

A Base Mini App where any expert publishes a shareable profile link; buyers pay USDC on Base into an escrow contract to unlock a private chat and/or a booking link. 95/5 split to expert/treasury on release, 7-day buyer refund window.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API on port 8080
- `pnpm --filter @workspace/linky run dev` — web app
- `pnpm --filter @workspace/api-spec run codegen` — regen API hooks + Zod schemas after editing `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema (dev only)
- `pnpm -w run typecheck` — full typecheck

### Required env (shared, set via secrets)

- `DATABASE_URL` — Postgres
- `AUTH_SECRET` — HMAC key for session bearer tokens
- `BASE_CHAIN` — `base-sepolia` (testnet) or `base` (mainnet)
- `LINKY_ESCROW_ADDRESS` — deployed `LinkyEscrow` address on the chosen chain
- `TREASURY_ADDRESS` — receiver of the 5% platform fee
- `PLATFORM_FEE_BPS` — `500` for 5%
- `REFUND_DELAY_SECONDS` — `604800` (7 days)

USDC is hardcoded by chain in `artifacts/api-server/src/lib/chain.ts` and `artifacts/linky/src/lib/chain.ts`.

## Stack

- pnpm workspaces, Node 24, TS 5.9
- API: Express 5, Drizzle ORM, Zod
- Web: React + Vite, wagmi + viem + OnchainKit MiniKit, Tailwind
- Contracts: Foundry-style Solidity in `contracts/LinkyEscrow.sol`
- Codegen: Orval from `lib/api-spec/openapi.yaml` → `lib/api-client-react`, `lib/api-zod`

## Where things live

- Escrow contract + deploy: `contracts/LinkyEscrow.sol`, `contracts/script/Deploy.s.sol`
- API: `artifacts/api-server/src/routes/{auth,experts,bookings,messages,config}.ts`
- DB schema: `lib/db/src/schema/{experts,bookings,messages}.ts`
- Frontend pages: `artifacts/linky/src/pages/{landing,new-expert,expert-profile,booking,dashboard}.tsx`
- Escrow call builders: `artifacts/linky/src/lib/escrow.ts`
- Session token store: `artifacts/linky/src/lib/session.ts`, wired via `setAuthTokenGetter` in `main.tsx`
- On-chain event verification: `artifacts/api-server/src/lib/escrow-events.ts`

## Architecture decisions

- **Source of truth is the chain.** `POST /bookings` only takes `{expertHandle, escrowBookingId, bookTxHash}` — the buyer wallet, amount, and expert are read from the on-chain `Booked` event log. Same for `Released` / `Refunded`. The server never trusts client-supplied identity for money state.
- **Auth = signed nonce → HMAC bearer.** `POST /auth/nonce` issues a one-time nonce; client signs `LINKY:<chainId>:login:<wallet>:<nonce>:<timestamp>` and exchanges it at `/auth/login` for a 24h bearer token (HMAC-signed, stored in `localStorage.linky.session`). All non-public reads + writes use `requireAuth` and check `req.wallet` for ownership.
- **Bookings are idempotent on the server.** `POST /bookings` short-circuits on existing `escrowBookingId` *or* `bookTxHash`, and catches Postgres `23505` to recover from races. The client never regenerates the booking id after the on-chain tx lands — it retries the same record.
- **Escrow uses caller-chosen bytes32 ids** so the client can pre-mint the id, build `approve + book` as a single `Transaction` batch, and the server can look the booking up later by id without ordering issues.

## Product

- `/new` — connect wallet, fill profile (name, bio, expertise, USDC price, access type chat/link/both, optional booking URL), sign create-expert message.
- `/:handle` — public premium profile; one-tap "Pay USDC" via MiniKit Transaction (`USDC.approve → escrow.book`).
- `/booking/:id` — wallet-gated unlock page: shows booking link + chat. Expert sees "Mark complete" → `escrow.release`. Buyer sees "Refund" once 7 days have elapsed → `escrow.refund`.
- `/dashboard` — expert's bookings, earnings totals, release shortcuts.
- Farcaster Frame meta + Base Mini App manifest emitted from the web app root.

## User preferences

_Populate as the user gives feedback._

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` *before* typecheck — the generated client + zod live in `lib/api-client-react/src/generated` and `lib/api-zod/src/generated`.
- The escrow contract must be deployed and `LINKY_ESCROW_ADDRESS` set before `/api/config` returns a non-null `escrowAddress`; until then the profile page shows an "Escrow not configured" banner and the pay button is disabled.
- USDC on Base Sepolia is `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals). Mainnet USDC differs — switch via `BASE_CHAIN`.
- Don't put `/api/...` literally in fetch calls — the generated client uses a relative base, which the Vite proxy and the deployed reverse proxy both handle.

## Pointers

- See the `pnpm-workspace` skill for monorepo conventions.
- See the `deployment` skill before publishing.
