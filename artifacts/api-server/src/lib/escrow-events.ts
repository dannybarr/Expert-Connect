import { createPublicClient, http, decodeEventLog, parseAbiItem, type Hex, type AbiEvent } from "viem";
import { base, baseSepolia } from "viem/chains";

function chain() {
  const which = (process.env.BASE_CHAIN ?? "base-sepolia").toLowerCase();
  return which === "base" || which === "mainnet" ? base : baseSepolia;
}

const publicClient = createPublicClient({
  chain: chain(),
  transport: http(process.env.BASE_RPC_URL || chain().rpcUrls.default.http[0]),
});

const bookedEvent = parseAbiItem(
  "event Booked(bytes32 indexed id, address indexed buyer, address indexed expert, uint256 amount)",
) as AbiEvent;

/**
 * Pull the matching `Booked` event from the receipt and return the buyer
 * address (lower-cased) and the on-chain amount if and only if there is
 * exactly one event matching the booking id and expert. The amount is
 * returned as ground truth — callers should NOT compare it to a mutable
 * off-chain price; the chain is the source of truth for what the buyer paid.
 */
export async function extractBooked(args: {
  txHash: string;
  bookingId: string;
  expert: string;
}): Promise<{ buyer: string; amount: bigint } | null> {
  const escrow = (process.env.LINKY_ESCROW_ADDRESS ?? "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(escrow)) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(args.txHash)) return null;
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: args.txHash as Hex });
  } catch {
    return null;
  }
  if (receipt.status !== "success") return null;

  const idLower = args.bookingId.toLowerCase();
  const expertLower = args.expert.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== escrow) continue;
    try {
      const d = decodeEventLog({
        abi: [bookedEvent],
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      const a = (d as unknown as { args: { id: string; buyer: string; expert: string; amount: bigint } }).args;
      if (
        a.id.toLowerCase() === idLower &&
        a.expert.toLowerCase() === expertLower &&
        a.amount > 0n
      ) {
        return { buyer: a.buyer.toLowerCase(), amount: a.amount };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}
