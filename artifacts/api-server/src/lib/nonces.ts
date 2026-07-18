import crypto from "node:crypto";

const NONCE_TTL_SECONDS = 5 * 60;
const MAX_NONCES = 5000;

type Entry = { wallet: string; expiresAt: number };

const store = new Map<string, Entry>();

function sweep(now: number): void {
  if (store.size < MAX_NONCES) {
    for (const [k, v] of store) {
      if (v.expiresAt <= now) store.delete(k);
    }
    return;
  }
  // Hard cap: drop oldest insertion order
  const toRemove = store.size - MAX_NONCES + 1;
  let i = 0;
  for (const k of store.keys()) {
    if (i++ >= toRemove) break;
    store.delete(k);
  }
}

export function issueNonce(wallet: string): { nonce: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  sweep(now);
  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = now + NONCE_TTL_SECONDS;
  store.set(nonce, { wallet: wallet.toLowerCase(), expiresAt });
  return { nonce, expiresAt };
}

export function consumeNonce(nonce: string, wallet: string): boolean {
  const e = store.get(nonce);
  if (!e) return false;
  // One-time use
  store.delete(nonce);
  if (e.expiresAt < Math.floor(Date.now() / 1000)) return false;
  if (e.wallet !== wallet.toLowerCase()) return false;
  return true;
}
