# LinkyEscrow

Solidity escrow contract that powers LINKY's pay-to-speak flow.

## Lifecycle

1. **`book(bytes32 id, address expert, uint256 amount)`** — Buyer calls
   `USDC.approve(escrow, amount)` then `escrow.book(...)`. Contract pulls USDC
   via `transferFrom` and holds it. Emits `Booked(id, buyer, expert, amount)`.

2. **`release(bytes32 id)`** — Only the expert can call. Splits funds
   95% → expert, 5% → treasury (configurable via `feeBps`). Emits
   `Released(id, expert, expertAmount, feeAmount)`.

3. **`refund(bytes32 id)`** — Only the buyer can call, and only after
   `refundDelay` seconds have elapsed since `book`. Returns the full
   amount to the buyer. Emits `Refunded(id, buyer, amount)`.

All state transitions are guarded; an `id` can only progress
NONE → ACTIVE → (RELEASED | REFUNDED).

## Deployment (Base Sepolia)

```sh
export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
export TREASURY=0xYourTreasuryWallet
export FEE_BPS=500            # 5%
export REFUND_DELAY=604800    # 7 days
export PRIVATE_KEY=0x...

forge script contracts/Deploy.s.sol:Deploy \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast --verify
```

Once deployed, set the server env vars and restart the API workflow:

```sh
LINKY_ESCROW_ADDRESS=0x...the-deployed-address
TREASURY_ADDRESS=0xYourTreasuryWallet
PLATFORM_FEE_BPS=500
REFUND_DELAY_SECONDS=604800
BASE_CHAIN=base-sepolia
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
AUTH_SECRET=<random 32+ char string>
```

The frontend reads `LINKY_ESCROW_ADDRESS` via `GET /api/config` and uses
it for the `book` / `release` / `refund` transactions.
