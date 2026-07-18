const KEY = "linky.session";

export type Session = { token: string; wallet: string; expiresAt: number };

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || !s.wallet || !s.expiresAt) return null;
    if (s.expiresAt * 1000 < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

export function getTokenForWallet(wallet: string | undefined | null): string | null {
  if (!wallet) return null;
  const s = loadSession();
  if (!s) return null;
  if (s.wallet.toLowerCase() !== wallet.toLowerCase()) return null;
  return s.token;
}
