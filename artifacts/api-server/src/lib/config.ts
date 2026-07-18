export interface ChainConfig {
  chainId: number;
  chainName: string;
  usdcAddress: string;
  explorerBaseUrl: string;
}

const BASE_SEPOLIA: ChainConfig = {
  chainId: 84532,
  chainName: "Base Sepolia",
  usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  explorerBaseUrl: "https://sepolia.basescan.org",
};

const BASE_MAINNET: ChainConfig = {
  chainId: 8453,
  chainName: "Base",
  usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  explorerBaseUrl: "https://basescan.org",
};

export function getChainConfig(): ChainConfig {
  // Default to mainnet so an unset/empty BASE_CHAIN in production never silently
  // falls back to Sepolia. Set BASE_CHAIN=base-sepolia (or "sepolia"/"testnet")
  // for local/testnet runs. This matches the default in auth.ts.
  const which = (process.env["BASE_CHAIN"] ?? "mainnet").toLowerCase();
  if (which === "sepolia" || which === "testnet" || which === "base-sepolia") {
    return BASE_SEPOLIA;
  }
  return BASE_MAINNET;
}

export function getTreasuryAddress(): string {
  return (
    process.env["TREASURY_ADDRESS"] ??
    "0x000000000000000000000000000000000000dEaD"
  );
}

export const PLATFORM_FEE_BPS = 500;

export function getCdpApiKey(): string | null {
  return process.env["CDP_API_KEY"] ?? null;
}

export function isCdpConfigured(): boolean {
  return !!getCdpApiKey();
}
