import { encodeFunctionData, parseUnits } from "viem";

export const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export const ESCROW_ABI = [
  {
    name: "book",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "expert", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "release",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "refund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [],
  },
] as const;

export function randomBookingId(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex as `0x${string}`;
}

/**
 * A single ERC-20 transfer that sends the price in USDC directly to the
 * expert's wallet. No escrow, no approval, no platform fee.
 */
export function buildTransferCall(args: {
  usdcAddress: string;
  expertWallet: string;
  priceUsdc: string;
}) {
  const amount = parseUnits(args.priceUsdc, 6);
  return [
    {
      to: args.usdcAddress as `0x${string}`,
      data: encodeFunctionData({
        abi: USDC_ABI,
        functionName: "transfer",
        args: [args.expertWallet as `0x${string}`, amount],
      }),
    },
  ];
}

/**
 * Split the listed price into a platform fee and the seller's payout, both as
 * direct ERC-20 transfers in the same batched transaction (no escrow, no
 * approval). The fee (priceUsdc * feeBps / 10000) goes to the treasury and the
 * remainder goes to the expert. The fee transfer is omitted when it rounds to
 * zero so a tiny price never produces a wasteful 0-value transfer.
 */
export function buildSplitTransferCalls(args: {
  usdcAddress: string;
  expertWallet: string;
  treasuryAddress: string;
  priceUsdc: string;
  feeBps: number;
}) {
  const total = parseUnits(args.priceUsdc, 6);
  const feeAmount = (total * BigInt(Math.round(args.feeBps))) / 10000n;
  const sellerAmount = total - feeAmount;
  const usdc = args.usdcAddress as `0x${string}`;
  const calls: { to: `0x${string}`; data: `0x${string}` }[] = [];
  if (feeAmount > 0n) {
    calls.push({
      to: usdc,
      data: encodeFunctionData({
        abi: USDC_ABI,
        functionName: "transfer",
        args: [args.treasuryAddress as `0x${string}`, feeAmount],
      }),
    });
  }
  calls.push({
    to: usdc,
    data: encodeFunctionData({
      abi: USDC_ABI,
      functionName: "transfer",
      args: [args.expertWallet as `0x${string}`, sellerAmount],
    }),
  });
  return calls;
}

export function buildBookCalls(args: {
  usdcAddress: string;
  escrowAddress: string;
  expertWallet: string;
  priceUsdc: string;
  bookingId: `0x${string}`;
}) {
  const amount = parseUnits(args.priceUsdc, 6);
  return [
    {
      to: args.usdcAddress as `0x${string}`,
      data: encodeFunctionData({
        abi: USDC_ABI,
        functionName: "approve",
        args: [args.escrowAddress as `0x${string}`, amount],
      }),
    },
    {
      to: args.escrowAddress as `0x${string}`,
      data: encodeFunctionData({
        abi: ESCROW_ABI,
        functionName: "book",
        args: [args.bookingId, args.expertWallet as `0x${string}`, amount],
      }),
    },
  ];
}

export function buildReleaseCalls(args: {
  escrowAddress: string;
  bookingId: `0x${string}`;
}) {
  return [
    {
      to: args.escrowAddress as `0x${string}`,
      data: encodeFunctionData({
        abi: ESCROW_ABI,
        functionName: "release",
        args: [args.bookingId],
      }),
    },
  ];
}

export function buildRefundCalls(args: {
  escrowAddress: string;
  bookingId: `0x${string}`;
}) {
  return [
    {
      to: args.escrowAddress as `0x${string}`,
      data: encodeFunctionData({
        abi: ESCROW_ABI,
        functionName: "refund",
        args: [args.bookingId],
      }),
    },
  ];
}
