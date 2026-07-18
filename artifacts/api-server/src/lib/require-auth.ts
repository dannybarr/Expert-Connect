import { type Request, type Response, type NextFunction } from "express";
import { verifyAuthToken } from "./auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      wallet?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const v = verifyAuthToken(m[1]);
  if (!v) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.wallet = v.wallet;
  next();
}
