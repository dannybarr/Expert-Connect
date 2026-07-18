import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(opts: { windowMs: number; max: number; keyPrefix?: string }) {
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const windowStart = Math.floor(now / opts.windowMs) * opts.windowMs;
    const key = `${opts.keyPrefix ?? "rl"}:${ip}:${windowStart}`;
    const existing = buckets.get(key);
    const bucket: Bucket = existing ?? { count: 0, resetAt: windowStart + opts.windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }
    res.setHeader("X-RateLimit-Limit", String(opts.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, opts.max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.floor(bucket.resetAt / 1000)));
    if (bucket.count > opts.max) {
      res
        .status(429)
        .json({ error: "Too many requests", code: "rate_limited" });
      return;
    }
    next();
  };
}
