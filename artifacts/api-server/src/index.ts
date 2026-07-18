import app from "./app";
import { logger } from "./lib/logger";
import { startWebhookWorker } from "./lib/webhooks";
import { startChainWatcher } from "./lib/chain-watcher";
import {
  getChainId,
  getChainName,
  getEscrowAddress,
  isTreasuryConfigured,
} from "./lib/auth";
import { isCdpConfigured } from "./lib/config";

function warnIfMisconfigured() {
  if (!getEscrowAddress()) {
    logger.warn(
      "LINKY_ESCROW_ADDRESS is not set or invalid — payments are disabled until the escrow contract is deployed and the env var is configured.",
    );
  }
  if (!isTreasuryConfigured()) {
    logger.warn(
      "TREASURY_ADDRESS is not set to a real address — platform fees will be routed to a burn address. Set TREASURY_ADDRESS before going live.",
    );
  }
  if (getChainId() !== 8453) {
    logger.warn(
      { chainId: getChainId(), chainName: getChainName() },
      "BASE_CHAIN is not set to mainnet — running on testnet. Set BASE_CHAIN=mainnet for production.",
    );
  }
  if (!isCdpConfigured()) {
    logger.warn(
      "CDP_API_KEY is not set — server-side Coinbase Developer Platform calls are disabled. Set CDP_API_KEY for production.",
    );
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  warnIfMisconfigured();
  startWebhookWorker();
  startChainWatcher();
  logger.info({ port }, "Server listening");
});
