import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Wallet,
  ConnectWallet,
} from "@coinbase/onchainkit/wallet";
import { Avatar, Name } from "@coinbase/onchainkit/identity";
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusLabel,
} from "@coinbase/onchainkit/transaction";
import { parseUnits } from "viem";
import {
  MessageSquare,
  Calendar,
  ExternalLink,
  Copy,
  CheckCircle2,
  Loader2,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { buildSplitTransferCalls } from "@/lib/escrow";
import { fmtUsdc } from "@/lib/fmt";

type Channel = "messaging" | "calls";
type PlatformConfig = {
  chainId: number;
  chainName: string;
  usdcAddress: string;
  escrowAddress: string | null;
  treasuryAddress: string;
  platformFeeBps: number;
  refundDelaySeconds: number;
  explorerBaseUrl: string;
};
type RevealData = {
  channel: Channel;
  platform: "whatsapp" | "telegram" | null;
  handle: string | null;
  bookingUrl: string | null;
};

function messagingDeepLink(platform: "whatsapp" | "telegram", handle: string) {
  const trimmed = handle.trim().replace(/^@/, "");
  if (platform === "whatsapp") {
    const digits = trimmed.replace(/[^\d]/g, "");
    return `https://wa.me/${digits}`;
  }
  return `https://t.me/${trimmed}`;
}

export function PaySheet({
  open,
  onOpenChange,
  expertHandle,
  expertName,
  expertWallet,
  expertAvatarUrl,
  channel,
  priceUsdc,
  config,
  bookingId,
  revealed,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  expertHandle: string;
  expertName: string;
  expertWallet: string;
  expertAvatarUrl?: string | null;
  channel: Channel;
  priceUsdc: string;
  config: PlatformConfig | undefined;
  bookingId: `0x${string}`;
  revealed: RevealData | undefined;
  onPaid: (txHash: string, channel: Channel, email: string) => void;
}) {
  const { toast } = useToast();
  const { isConnected, chainId: connectedChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { isAuthenticated, signIn } = useAuth();

  type Phase =
    | "idle"
    | "approving"
    | "paying"
    | "confirming"
    | "success"
    | "error";
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // Bump to reset the OnchainKit <Transaction> component on retry so it can be
  // re-triggered without a page reload.
  const [retryKey, setRetryKey] = useState(0);
  const paidRef = useRef(false);

  const isRevealed =
    !!revealed &&
    ((channel === "messaging" && !!revealed.handle && !!revealed.platform) ||
      (channel === "calls" && !!revealed.bookingUrl));

  // Reset internal state whenever the sheet closes so the next open is clean.
  useEffect(() => {
    if (!open) {
      paidRef.current = false;
      setPhase("idle");
      setErrorMsg(null);
      setTxHash(null);
      setEmail("");
    }
  }, [open]);

  // When we have a reveal (either fresh from this session or persisted), make
  // sure we are in the success phase so the sheet renders the revealed state.
  useEffect(() => {
    if (open && isRevealed && phase !== "success") {
      setPhase("success");
    }
  }, [open, isRevealed, phase]);

  // Silently nudge to Base when we're on the wrong network.
  useEffect(() => {
    if (!open || !isConnected || !config) return;
    if (connectedChainId && connectedChainId !== config.chainId) {
      switchChainAsync({ chainId: config.chainId }).catch(() => {
        /* user can reject; OnchainKit will also prompt on tx */
      });
    }
  }, [open, isConnected, connectedChainId, config, switchChainAsync]);

  const total = useMemo(() => {
    try {
      return parseUnits(priceUsdc, 6);
    } catch {
      return 0n;
    }
  }, [priceUsdc]);

  const calls =
    config && total > 0n
      ? buildSplitTransferCalls({
          usdcAddress: config.usdcAddress,
          expertWallet,
          treasuryAddress: config.treasuryAddress,
          priceUsdc,
          feeBps: config.platformFeeBps,
        })
      : [];

  const channelLabel = channel === "messaging" ? "Private message" : "Calendar slot";
  const channelSubcopy =
    channel === "messaging"
      ? "Their DM handle unlocks the instant payment confirms."
      : "Their booking link unlocks the instant payment confirms.";
  const ChannelIcon = channel === "messaging" ? MessageSquare : Calendar;

  const phaseLabel: Record<Phase, string> = {
    idle: "Confirm in your wallet",
    approving: "Approving USDC…",
    paying: "Sending payment…",
    confirming: "Confirming on Base…",
    success: "Paid",
    error: "Payment didn't go through",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-db-bg border-t-[2.5px] border-db-ink rounded-t-[24px] p-0 max-h-[92dvh] overflow-y-auto"
        data-testid={`pay-sheet-${channel}`}
      >
        <div className="mx-auto w-full max-w-md px-6 pt-6 pb-8 flex flex-col gap-5">
          {/* Drag handle */}
          <div className="mx-auto h-1.5 w-12 rounded-full bg-db-ink/15" />

          <SheetHeader className="text-left space-y-1">
            <SheetTitle className="font-display text-2xl font-bold tracking-[-0.01em] text-db-ink">
              {phase === "success" || isRevealed
                ? channel === "messaging"
                  ? "Handle unlocked"
                  : "Booking link unlocked"
                : channelLabel}
            </SheetTitle>
            <SheetDescription className="text-db-mute text-sm">
              {phase === "success" || isRevealed
                ? `Receipt saved. Tap to message ${expertName.split(" ")[0]}.`
                : channelSubcopy}
            </SheetDescription>
          </SheetHeader>

          {/* Identity row */}
          <div className="flex items-center gap-3 p-3 rounded-[16px] border-[2.5px] border-db-ink bg-db-bg-alt">
            {expertAvatarUrl ? (
              <img
                src={expertAvatarUrl}
                alt={expertName}
                className="w-11 h-11 rounded-full object-cover border-[2px] border-db-ink"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-db-cobalt text-db-cream border-[2px] border-db-ink flex items-center justify-center font-display font-bold text-lg">
                {expertName.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold leading-tight truncate">
                {expertName}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute">
                @{expertHandle}
              </div>
            </div>
            <div className="flex items-center justify-center w-9 h-9 rounded-[10px] border-[2px] border-db-ink bg-db-bg">
              <ChannelIcon className="w-4 h-4" />
            </div>
          </div>

          {/* Body — branches on phase */}
          {(phase === "success" || isRevealed) && revealed ? (
            <div className="flex flex-col gap-3">
              {channel === "messaging" && revealed.handle && revealed.platform && (
                <>
                  <a
                    href={messagingDeepLink(revealed.platform, revealed.handle)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-14 w-full items-center justify-center px-6 bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] font-display font-bold text-lg shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px transition-transform"
                    data-testid={`sheet-open-${channel}`}
                  >
                    Open {revealed.platform === "whatsapp" ? "WhatsApp" : "Telegram"}
                    <ExternalLink className="ml-2 w-4 h-4" />
                  </a>
                  <div className="flex items-center gap-2 p-3 rounded-[12px] border-[2px] border-db-ink bg-db-bg-alt">
                    <div
                      className="flex-1 min-w-0 font-mono text-sm truncate"
                      data-testid={`sheet-handle-${channel}`}
                    >
                      {revealed.platform === "whatsapp"
                        ? revealed.handle
                        : `@${revealed.handle.replace(/^@/, "")}`}
                    </div>
                    <Button
                      size="sm"
                      variant="ink"
                      onClick={() => {
                        navigator.clipboard.writeText(revealed.handle ?? "");
                        toast({ title: "Copied" });
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                  </div>
                </>
              )}
              {channel === "calls" && revealed.bookingUrl && (
                <>
                  <a
                    href={revealed.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-14 w-full items-center justify-center px-6 bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] font-display font-bold text-lg shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px transition-transform"
                    data-testid={`sheet-open-${channel}`}
                  >
                    Open booking page
                    <ExternalLink className="ml-2 w-4 h-4" />
                  </a>
                  <div className="flex items-center gap-2 p-3 rounded-[12px] border-[2px] border-db-ink bg-db-bg-alt">
                    <div
                      className="flex-1 min-w-0 font-mono text-xs truncate"
                      data-testid={`sheet-url-${channel}`}
                    >
                      {revealed.bookingUrl}
                    </div>
                    <Button
                      size="sm"
                      variant="ink"
                      onClick={() => {
                        navigator.clipboard.writeText(revealed.bookingUrl ?? "");
                        toast({ title: "Copied" });
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                  </div>
                </>
              )}
              {txHash && config && (
                <a
                  href={`${config.explorerBaseUrl}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute hover:text-db-cobalt"
                  data-testid="sheet-receipt"
                >
                  <CheckCircle2 className="w-3 h-3" /> Paid · receipt
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {!txHash && (
                <div className="inline-flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute">
                  <CheckCircle2 className="w-3 h-3" /> Already paid · access restored
                </div>
              )}
              {email && (
                <div className="inline-flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute">
                  <Mail className="w-3 h-3" /> Also sent to {email}
                </div>
              )}
              {/* Auth nudge: reveal endpoint needs a signed session. */}
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={() => signIn()}
                  className="text-[11px] font-mono uppercase tracking-[0.08em] text-db-mute underline decoration-dotted self-center"
                >
                  Sign in to keep this unlocked on this device
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Price summary */}
              <div className="p-4 rounded-[16px] border-[2.5px] border-db-ink bg-db-bg">
                <div className="flex items-baseline justify-between">
                  <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute">
                    You pay
                  </div>
                  <div className="text-right">
                    <div className="font-display text-4xl font-bold tracking-[-0.02em] leading-none">
                      ${fmtUsdc(priceUsdc)}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-db-mute mt-1">
                      USDC · Base
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-db-ink/15 flex items-center justify-center text-[11px] font-mono uppercase tracking-[0.04em] text-db-mute text-center">
                  {config
                    ? `$${fmtUsdc(Number(priceUsdc) * (1 - config.platformFeeBps / 10000))} to ${expertName.split(" ")[0]} · $${fmtUsdc((Number(priceUsdc) * config.platformFeeBps) / 10000)} platform fee`
                    : `Paid to ${expertName.split(" ")[0]} on Base`}
                </div>
              </div>

              {/* Email capture — the unlocked contact is also sent here */}
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute inline-flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email for your receipt &amp; contact
                </span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="pay-email"
                  className="h-12 px-4 rounded-[12px] border-[2.5px] border-db-ink bg-db-bg font-mono text-sm text-db-ink placeholder:text-db-mute/60 focus:outline-none focus:ring-2 focus:ring-db-cobalt"
                />
              </label>

              {/* Final-payment disclaimer */}
              <div className="text-[11px] font-mono text-db-mute text-center leading-relaxed">
                All payments are final — DeFi too quick we can't get it back
              </div>

              {/* Progress indicator (single, in-place) */}
              {(phase === "approving" ||
                phase === "paying" ||
                phase === "confirming") && (
                <div
                  className="flex items-center gap-3 p-3 rounded-[12px] border-[2px] border-db-ink bg-db-honey/30"
                  data-testid="pay-progress"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-db-ink">
                    {phaseLabel[phase]}
                  </div>
                </div>
              )}

              {/* Error */}
              {phase === "error" && (
                <div
                  className="p-3 rounded-[12px] border-[2px] border-db-ink bg-db-coral/20 text-sm text-db-ink"
                  data-testid="pay-error"
                >
                  <div className="font-display font-bold">
                    Payment didn't go through.
                  </div>
                  <div className="text-db-mute">
                    {errorMsg ??
                      "Nothing was charged. Tap retry to try again."}
                  </div>
                </div>
              )}

              {/* Primary action */}
              {!emailValid ? (
                <div
                  className="w-full h-14 flex items-center justify-center bg-db-bg-alt text-db-mute border-[2.5px] border-db-ink rounded-[16px] font-display font-bold text-lg"
                  data-testid="pay-need-email"
                >
                  Enter your email to continue
                </div>
              ) : !isConnected ? (
                <Wallet>
                  <ConnectWallet
                    className="w-full h-14 bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] font-display font-bold text-lg shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px transition-transform"
                    data-testid="sheet-connect"
                  >
                    <Avatar className="h-5 w-5" />
                    <Name />
                  </ConnectWallet>
                </Wallet>
              ) : (
                <Transaction
                  key={retryKey}
                  chainId={config!.chainId}
                  calls={calls}
                  isSponsored
                  capabilities={
                    import.meta.env.VITE_PAYMASTER_URL
                      ? {
                          paymasterService: {
                            url: import.meta.env.VITE_PAYMASTER_URL as string,
                          },
                        }
                      : undefined
                  }
                  onStatus={(s: { statusName?: string }) => {
                    const n = s?.statusName;
                    if (!n) return;
                    if (
                      n === "transactionPending" ||
                      n === "buildingTransaction"
                    ) {
                      setPhase("approving");
                    } else if (n === "transactionLegacyExecuted") {
                      // EOA fallback finished the first leg (approve), now paying.
                      setPhase("paying");
                    } else if (n === "success") {
                      setPhase("confirming");
                    } else if (n === "error") {
                      setPhase((prev) =>
                        prev === "approving" ||
                        prev === "paying" ||
                        prev === "confirming"
                          ? "error"
                          : "idle",
                      );
                    }
                  }}
                  onSuccess={(response: {
                    transactionReceipts?: Array<{ transactionHash: string }>;
                  }) => {
                    if (paidRef.current) return;
                    const receipts = response.transactionReceipts;
                    if (!receipts || receipts.length === 0) return;
                    const last = receipts[receipts.length - 1];
                    if (!last) return;
                    const hash = last.transactionHash;
                    paidRef.current = true;
                    setTxHash(hash);
                    onPaid(hash, channel, email.trim());
                  }}
                  onError={(e: { code?: string; message?: string }) => {
                    const msg = e?.message ?? "";
                    const code = e?.code ?? "";
                    // Silent on user rejections — return to idle, no toast noise.
                    if (
                      /rejected|denied|user (rejected|cancelled)/i.test(msg) ||
                      code === "4001" ||
                      code === "ACTION_REJECTED"
                    ) {
                      setPhase("idle");
                      return;
                    }
                    setErrorMsg(
                      msg.length > 0 && msg.length < 160
                        ? msg
                        : "Try again in a moment.",
                    );
                    setPhase("error");
                  }}
                >
                  {phase === "error" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setPhase("idle");
                        setRetryKey((k) => k + 1);
                      }}
                      className="w-full h-14 bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] font-display font-bold text-lg shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px transition-transform"
                      data-testid="sheet-retry"
                    >
                      Try again
                    </button>
                  ) : (
                    <TransactionButton
                      className="w-full h-14 bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] font-display font-bold text-lg shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px transition-transform disabled:opacity-100"
                      text={`Confirm & pay $${fmtUsdc(priceUsdc)}`}
                    />
                  )}
                  {/* Hidden status — we render our own progress line above. */}
                  <div className="sr-only">
                    <TransactionStatus>
                      <TransactionStatusLabel />
                    </TransactionStatus>
                  </div>
                </Transaction>
              )}

              <div className="text-center text-[11px] font-mono uppercase tracking-[0.08em] text-db-mute">
                One signature · gas sponsored when supported
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
