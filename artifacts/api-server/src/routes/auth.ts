import { Router, type IRouter } from "express";
import { LoginBody, LoginResponse, RequestLoginNonceBody, RequestLoginNonceResponse } from "@workspace/api-zod";
import { issueAuthToken, verifySignedMessage } from "../lib/auth.js";
import { issueNonce, consumeNonce } from "../lib/nonces.js";

const router: IRouter = Router();

router.post("/auth/nonce", async (req, res) => {
  const body = RequestLoginNonceBody.parse(req.body);
  if (!/^0x[0-9a-fA-F]{40}$/.test(body.wallet)) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }
  const { nonce, expiresAt } = issueNonce(body.wallet);
  return res.json(RequestLoginNonceResponse.parse({ nonce, expiresAt }));
});

router.post("/auth/login", async (req, res) => {
  const body = LoginBody.parse(req.body);
  const wallet = body.wallet.toLowerCase();
  if (!consumeNonce(body.nonce, wallet)) {
    return res.status(401).json({ error: "Unknown, expired, or already-used nonce" });
  }
  const v = await verifySignedMessage({
    action: "login",
    resource: wallet,
    wallet,
    signature: body.signature,
    timestamp: body.timestamp,
    nonce: body.nonce,
  });
  if (!v.ok) return res.status(v.status).json({ error: v.error });
  const { token, expiresAt } = issueAuthToken(wallet);
  return res.json(LoginResponse.parse({ token, expiresAt, wallet }));
});

export default router;
