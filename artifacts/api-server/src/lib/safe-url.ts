import dns from "node:dns/promises";
import net from "node:net";

const ALLOW_PRIVATE = process.env.WEBHOOK_ALLOW_PRIVATE_URLS === "true";

function ipIsPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number) as [number, number, number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + AWS metadata 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.slice("::ffff:".length);
      if (net.isIPv4(v4)) return ipIsPrivate(v4);
    }
    return false;
  }
  return false;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * Validate a user-supplied webhook URL to prevent SSRF. Enforces https,
 * blocks IP-literal hosts, and (when DNS resolution is performed) blocks
 * targets that resolve to private/loopback/link-local/metadata ranges.
 */
export async function validateWebhookUrl(raw: string): Promise<ValidationResult> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (u.protocol !== "https:") {
    if (!(ALLOW_PRIVATE && u.protocol === "http:")) {
      return { ok: false, reason: "Webhook URL must use https://" };
    }
  }
  if (u.username || u.password) {
    return { ok: false, reason: "Webhook URL must not include credentials" };
  }
  const host = u.hostname;
  if (!host) return { ok: false, reason: "Webhook URL has no host" };

  if (ALLOW_PRIVATE) return { ok: true };

  // Reject IP-literal hosts outright; legitimate webhooks use hostnames.
  if (net.isIP(host)) {
    if (ipIsPrivate(host)) return { ok: false, reason: "Webhook host resolves to a private address" };
    return { ok: false, reason: "Webhook host must be a domain name, not an IP literal" };
  }

  const lower = host.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local") || lower.endsWith(".internal")) {
    return { ok: false, reason: "Webhook host is not allowed" };
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) return { ok: false, reason: "Webhook host did not resolve" };
    for (const r of records) {
      if (ipIsPrivate(r.address)) {
        return { ok: false, reason: "Webhook host resolves to a private address" };
      }
    }
  } catch {
    return { ok: false, reason: "Webhook host could not be resolved" };
  }
  return { ok: true };
}
