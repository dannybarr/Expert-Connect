import { Router, type IRouter } from "express";
import { GetConfigResponse } from "@workspace/api-zod";
import {
  getChainId,
  getChainName,
  getUsdcAddress,
  getEscrowAddress,
  getTreasuryAddress,
  getPlatformFeeBps,
  getRefundDelaySeconds,
  getExplorerBaseUrl,
} from "../lib/auth.js";

const router: IRouter = Router();

router.get("/config", (_req, res) => {
  const data = GetConfigResponse.parse({
    chainId: getChainId(),
    chainName: getChainName(),
    usdcAddress: getUsdcAddress(),
    escrowAddress: getEscrowAddress(),
    treasuryAddress: getTreasuryAddress(),
    platformFeeBps: getPlatformFeeBps(),
    refundDelaySeconds: getRefundDelaySeconds(),
    explorerBaseUrl: getExplorerBaseUrl(),
  });
  res.json(data);
});

export default router;
