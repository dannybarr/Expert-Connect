import crypto from "node:crypto";
import {
  createPublicClient,
  http,
  decodeEventLog,
  parseAbiItem,
  type Hex,
  type AbiEvent,
} from "viem";
import { base, baseSepolia } from "viem/chains";

const SIGNATURE_TTL_SECONDS = 5 * 60;
const TOKEN_TTL_SECONDS = 24 * 60 * 60;

function chainConfig() {
  const which = (process.env.BASE_CHAIN ?? "mainnet").toLowerCase();
  if (which === "base-sepolia" || which === "sepolia" || which === "testnet") {
    return {
      chain: baseSepolia,
      usdcAddress: (process.env.USDC_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e").toLowerCase() as Hex,
    };
  }
  return {
    chain: base,
    usdcAddress: (process.env.USDC_ADDRESS ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913").toLowerCase() as Hex,
  };
}

const { chain, usdcAddress } = chainConfig();
const rpcUrl = process.env.BASE_RPC_URL || chain.rpcUrls.default.http[0];
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

const bookedEvent = parseAbiItem(
  "event Booked(bytes32 indexed id, address indexed buyer, address indexed expert, uint256 amount)",
) as AbiEvent;
const releasedEvent = parseAbiItem(
  "event Released(bytes32 indexed id, address indexed expert, uint256 expertAmount, uint256 feeAmount)",
) as AbiEvent;
const refundedEvent = parseAbiItem(
  "event Refunded(bytes32 indexed id, address indexed buyer, uint256 amount)",
) as AbiEvent;
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
) as AbiEvent;

export function getChainId(): number { return chain.id; }
export function getChainName(): string { return chain.name; }
export function getUsdcAddress(): string { return usdcAddress; }
export function getEscrowAddress(): string | null {
  const v = process.env.LINKY_ESCROW_ADDRESS?.toLowerCase() ?? "";
  return /^0x[0-9a-f]{40}$/.test(v) ? v : null;
}
export function getTreasuryAddress(): string {
  const v = process.env.TREASURY_ADDRESS?.toLowerCase() ?? "";
  if (/^0x[0-9a-f]{40}$/.test(v)) return v;
  return "0x000000000000000000000000000000000000dead";
}
export function isTreasuryConfigured(): boolean {
  const v = process.env.TREASURY_ADDRESS?.toLowerCase() ?? "";
  return /^0x[0-9a-f]{40}$/.test(v) && v !== "0x000000000000000000000000000000000000dead";
}
export function getPlatformFeeBps(): number {
  return Number(process.env.PLATFORM_FEE_BPS ?? "500");
}
export function getRefundDelaySeconds(): number {
  return Number(process.env.REFUND_DELAY_SECONDS ?? `${7 * 24 * 60 * 60}`);
}
export function getExplorerBaseUrl(): string {
  return chain.id === base.id ? "https://basescan.org" : "https://sepolia.basescan.org";
}

// --------------------------------------------------------------------------
// HMAC bearer session tokens
// --------------------------------------------------------------------------

function authSecret(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET env var must be set to a string of at least 32 characters");
  }
  return Buffer.from(s, "utf8");
}

export function issueAuthToken(wallet: string, ttl = TOKEN_TTL_SECONDS): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const payload = JSON.stringify({ w: wallet.toLowerCase(), e: expiresAt });
  const payloadB = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", authSecret()).update(payloadB).digest("base64url");
  return { token: `${payloadB}.${sig}`, expiresAt };
}

export function verifyAuthToken(token: string): { wallet: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB, sigB] = parts;
  const expected = crypto.createHmac("sha256", authSecret()).update(payloadB).digest();
  let provided: Buffer;
  try { provided = Buffer.from(sigB, "base64url"); } catch { return null; }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  let payload: { w?: unknown; e?: unknown };
  try { payload = JSON.parse(Buffer.from(payloadB, "base64url").toString("utf8")); } catch { return null; }
  if (typeof payload.w !== "string" || typeof payload.e !== "number") return null;
  if (payload.e < Math.floor(Date.now() / 1000)) return null;
  return { wallet: payload.w };
}

// --------------------------------------------------------------------------
// SIWE-style signed-message verification (used for login + create-expert)
// --------------------------------------------------------------------------

export type SignedAction = "login" | "create-expert" | "agent-ask";

export async function verifySignedMessage(opts: {
  action: SignedAction;
  resource: string;
  wallet: string;
  signature: string;
  timestamp: number;
  nonce?: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(opts.timestamp) || Math.abs(now - opts.timestamp) > SIGNATURE_TTL_SECONDS) {
    return { ok: false, status: 401, error: "Signature timestamp expired or invalid" };
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(opts.wallet)) {
    return { ok: false, status: 400, error: "Invalid wallet address" };
  }
  if (!/^0x[0-9a-fA-F]+$/.test(opts.signature)) {
    return { ok: false, status: 400, error: "Invalid signature format" };
  }
  const message = opts.nonce
    ? `LINKY:${chain.id}:${opts.action}:${opts.resource}:${opts.nonce}:${opts.timestamp}`
    : `LINKY:${chain.id}:${opts.action}:${opts.resource}:${opts.timestamp}`;
  try {
    const valid = await publicClient.verifyMessage({
      address: opts.wallet as Hex,
      message,
      signature: opts.signature as Hex,
    });
    if (!valid) return { ok: false, status: 401, error: "Signature does not match wallet" };
    return { ok: true };
  } catch {
    return { ok: false, status: 401, error: "Signature verification failed" };
  }
}

// --------------------------------------------------------------------------
// Escrow on-chain event verification (Booked / Released / Refunded)
// --------------------------------------------------------------------------

type Verified = { ok: true } | { ok: false; status: number; error: string };

async function fetchReceipt(txHash: string) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return null;
  try {
    const r = await publicClient.getTransactionReceipt({ hash: txHash as Hex });
    if (r.status !== "success") return null;
    return r;
  } catch {
    return null;
  }
}

type ReceiptLog = { address: string; data: `0x${string}`; topics: readonly `0x${string}`[] };

function decodeAllAt(logs: readonly ReceiptLog[], escrow: string, event: AbiEvent): Array<Record<string, unknown>> {
  const escrowLower = escrow.toLowerCase();
  const out: Array<Record<string, unknown>> = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== escrowLower) continue;
    try {
      const decoded = decodeEventLog({
        abi: [event],
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      out.push(decoded as unknown as Record<string, unknown>);
    } catch {
      /* not the event we care about */
    }
  }
  return out;
}

function getArgs<T extends Record<string, unknown>>(e: Record<string, unknown>): Partial<T> {
  return (e.args as Partial<T>) ?? {};
}

export async function verifyBooked(args: {
  txHash: string;
  bookingId: string; // 0x-prefixed bytes32
  buyer: string;
  expert: string;
  expectedAmount: bigint;
}): Promise<Verified> {
  const escrow = getEscrowAddress();
  if (!escrow) return { ok: false, status: 503, error: "Escrow contract not configured" };
  const receipt = await fetchReceipt(args.txHash);
  if (!receipt) return { ok: false, status: 402, error: "Transaction not found, failed, or unconfirmed" };
  const events = decodeAllAt(receipt.logs as ReceiptLog[], escrow, bookedEvent);
  const idLower = args.bookingId.toLowerCase();
  const buyerLower = args.buyer.toLowerCase();
  const expertLower = args.expert.toLowerCase();
  for (const e of events) {
    const a = getArgs<{ id: string; buyer: string; expert: string; amount: bigint }>(e);
    if (
      (a.id ?? "").toLowerCase() === idLower &&
      (a.buyer ?? "").toLowerCase() === buyerLower &&
      (a.expert ?? "").toLowerCase() === expertLower &&
      a.amount === args.expectedAmount
    ) {
      return { ok: true };
    }
  }
  return { ok: false, status: 402, error: "No matching Booked event in transaction" };
}

export async function verifyReleased(args: {
  txHash: string;
  bookingId: string;
  expert: string;
}): Promise<Verified> {
  const escrow = getEscrowAddress();
  if (!escrow) return { ok: false, status: 503, error: "Escrow contract not configured" };
  const receipt = await fetchReceipt(args.txHash);
  if (!receipt) return { ok: false, status: 402, error: "Transaction not found, failed, or unconfirmed" };
  const events = decodeAllAt(receipt.logs as ReceiptLog[], escrow, releasedEvent);
  const idLower = args.bookingId.toLowerCase();
  const expertLower = args.expert.toLowerCase();
  for (const e of events) {
    const a = getArgs<{ id: string; expert: string }>(e);
    if ((a.id ?? "").toLowerCase() === idLower && (a.expert ?? "").toLowerCase() === expertLower) {
      return { ok: true };
    }
  }
  return { ok: false, status: 402, error: "No matching Released event in transaction" };
}

export async function verifyRefunded(args: {
  txHash: string;
  bookingId: string;
  buyer: string;
}): Promise<Verified> {
  const escrow = getEscrowAddress();
  if (!escrow) return { ok: false, status: 503, error: "Escrow contract not configured" };
  const receipt = await fetchReceipt(args.txHash);
  if (!receipt) return { ok: false, status: 402, error: "Transaction not found, failed, or unconfirmed" };
  const events = decodeAllAt(receipt.logs as ReceiptLog[], escrow, refundedEvent);
  const idLower = args.bookingId.toLowerCase();
  const buyerLower = args.buyer.toLowerCase();
  for (const e of events) {
    const a = getArgs<{ id: string; buyer: string }>(e);
    if ((a.id ?? "").toLowerCase() === idLower && (a.buyer ?? "").toLowerCase() === buyerLower) {
      return { ok: true };
    }
  }
  return { ok: false, status: 402, error: "No matching Refunded event in transaction" };
}

/**
 * Verify a direct USDC transfer to the expert wallet (no escrow). Confirms the
 * transaction succeeded and contains an ERC-20 `Transfer` to the expert for at
 * least the expected amount, then returns the buyer (the `from` address).
 * Retries briefly because the frontend calls this right after confirmation.
 */
export async function verifyUsdcTransfer(args: {
  txHash: string;
  expert: string;
  expectedAmount: bigint;
}): Promise<
  | { ok: true; buyer: string; amount: bigint }
  | { ok: false; status: number; error: string }
> {
  let receipt = await fetchReceipt(args.txHash);
  for (let i = 0; !receipt && i < 4; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    receipt = await fetchReceipt(args.txHash);
  }
  if (!receipt) {
    return { ok: false, status: 402, error: "Transaction not found, failed, or unconfirmed" };
  }
  const events = decodeAllAt(receipt.logs as ReceiptLog[], usdcAddress, transferEvent);
  const expertLower = args.expert.toLowerCase();
  for (const e of events) {
    const a = getArgs<{ from: string; to: string; value: bigint }>(e);
    if (
      (a.to ?? "").toLowerCase() === expertLower &&
      typeof a.value === "bigint" &&
      a.value >= args.expectedAmount
    ) {
      return { ok: true, buyer: (a.from ?? "").toLowerCase(), amount: a.value };
    }
  }
  return { ok: false, status: 402, error: "No matching USDC transfer to the expert in transaction" };
}

/**
 * Verify a split direct payment: the buyer pays the listed price in USDC,
 * divided into a platform fee to the treasury and the remainder to the expert,
 * both as ERC-20 `Transfer`s in the same transaction. Confirms the transaction
 * succeeded and contains a transfer to the expert for at least `expertAmount`
 * and (when `feeAmount > 0`) a transfer to the treasury for at least
 * `feeAmount`, then returns the buyer (the `from` address of the expert leg).
 * Retries briefly because the frontend calls this right after confirmation.
 */
export async function verifyUsdcSplitTransfer(args: {
  txHash: string;
  expert: string;
  treasury: string;
  expertAmount: bigint;
  feeAmount: bigint;
}): Promise<
  | { ok: true; buyer: string }
  | { ok: false; status: number; error: string }
> {
  let receipt = await fetchReceipt(args.txHash);
  for (let i = 0; !receipt && i < 4; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    receipt = await fetchReceipt(args.txHash);
  }
  if (!receipt) {
    return { ok: false, status: 402, error: "Transaction not found, failed, or unconfirmed" };
  }
  const events = decodeAllAt(receipt.logs as ReceiptLog[], usdcAddress, transferEvent);
  const expertLower = args.expert.toLowerCase();
  const treasuryLower = args.treasury.toLowerCase();

  let buyer: string | null = null;
  for (const e of events) {
    const a = getArgs<{ from: string; to: string; value: bigint }>(e);
    if (
      (a.to ?? "").toLowerCase() === expertLower &&
      typeof a.value === "bigint" &&
      a.value >= args.expertAmount
    ) {
      buyer = (a.from ?? "").toLowerCase();
      break;
    }
  }
  if (!buyer) {
    return { ok: false, status: 402, error: "No matching USDC transfer to the expert in transaction" };
  }

  if (args.feeAmount > 0n) {
    const feePaid = events.some((e) => {
      const a = getArgs<{ from: string; to: string; value: bigint }>(e);
      return (
        (a.to ?? "").toLowerCase() === treasuryLower &&
        typeof a.value === "bigint" &&
        a.value >= args.feeAmount
      );
    });
    if (!feePaid) {
      return { ok: false, status: 402, error: "No matching USDC fee transfer to the treasury in transaction" };
    }
  }

  return { ok: true, buyer };
}
