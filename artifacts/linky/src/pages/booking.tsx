import { Helmet } from "react-helmet-async";
import { useParams } from "wouter";
import {
  useGetBooking,
  useGetConfig,
  useGetExpert,
  useRevealExpertContact,
  useCompleteBooking,
  useRefundBooking,
  getGetBookingQueryKey,
  getGetExpertQueryKey,
  getRevealExpertContactQueryKey,
} from "@workspace/api-client-react";
import { useAccount } from "wagmi";
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from "@coinbase/onchainkit/transaction";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { buildReleaseCalls, buildRefundCalls } from "@/lib/escrow";
import { fmtUsdc } from "@/lib/fmt";
import { Button } from "@/components/ui/button";
import { ExternalLink, Lock, CheckCircle2, MessageSquare, Calendar, Copy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import NotFound from "./not-found";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-db-forest text-db-cream",
    refunded: "bg-db-honey text-db-ink",
    paid: "bg-db-cobalt text-db-cream",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border-[2.5px] border-db-ink font-mono text-[10px] font-semibold uppercase tracking-[0.08em] shadow-[3px_3px_0_var(--db-ink)] ${map[status] ?? "bg-db-bg text-db-ink"}`}
    >
      {status === "paid" ? "In escrow" : status}
    </span>
  );
}

function messagingDeepLink(platform: "whatsapp" | "telegram", handle: string): string {
  const trimmed = handle.trim().replace(/^@/, "");
  if (platform === "whatsapp") {
    const digits = trimmed.replace(/[^\d]/g, "");
    return `https://wa.me/${digits}`;
  }
  return `https://t.me/${trimmed}`;
}

export default function BookingPage() {
  const params = useParams();
  const id = params.id || "";
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated, signIn, isSigningIn } = useAuth();

  const { data: booking, isError: isBookingError, isLoading: isBookingLoading } = useGetBooking(id, {
    query: { enabled: !!id && isAuthenticated, queryKey: getGetBookingQueryKey(id) },
  });

  const { data: config } = useGetConfig();

  const { data: expert } = useGetExpert(booking?.expertHandle || "", {
    query: {
      enabled: !!booking?.expertHandle,
      queryKey: getGetExpertQueryKey(booking?.expertHandle || ""),
    },
  });

  const isBuyer =
    !!address && !!booking && address.toLowerCase() === booking.buyerWallet.toLowerCase();
  const canReveal = isBuyer && booking && (booking.status === "paid" || booking.status === "completed");

  const { data: revealed } = useRevealExpertContact(
    booking?.expertHandle || "",
    (booking?.channel ?? "messaging") as "messaging" | "calls",
    {
      query: {
        enabled: !!booking?.expertHandle && !!booking?.channel && !!canReveal && isAuthenticated,
        queryKey: getRevealExpertContactQueryKey(
          booking?.expertHandle || "",
          (booking?.channel ?? "messaging") as "messaging" | "calls",
        ),
        retry: false,
      },
    },
  );

  const completeBooking = useCompleteBooking();
  const refundBooking = useRefundBooking();

  if (!address) {
    return (
      <div className="container max-w-lg mx-auto px-4 py-24 flex flex-col items-start gap-6">
        <Helmet><title>Private Booking</title></Helmet>
        <span className="db-pill ink"><Lock className="w-3 h-3" /> Private</span>
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em]">This one's private.</h1>
        <p className="text-db-mute">Plug in the wallet on the receipt to open it.</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container max-w-lg mx-auto px-4 py-24 flex flex-col items-start gap-6">
        <Helmet><title>Sign in to LINKY</title></Helmet>
        <span className="db-pill ink"><Lock className="w-3 h-3" /> Private</span>
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em]">Sign in to read this.</h1>
        <p className="text-db-mute">One signature with your wallet. No gas. Proves it's you.</p>
        <Button onClick={signIn} disabled={isSigningIn} size="lg">
          {isSigningIn ? "Signing..." : "Sign in"}
        </Button>
      </div>
    );
  }

  if (isBookingLoading)
    return <div className="min-h-[50vh] flex items-center justify-center font-mono uppercase tracking-[0.08em] text-db-mute">Loading…</div>;
  if (isBookingError || !booking) return <NotFound />;

  const isExpert = address.toLowerCase() === booking.expertWallet.toLowerCase();

  const escrowReady = !!config?.escrowAddress;
  // Only escrow-backed (agent) bookings can be released/refunded on-chain. Web
  // bookings are instant, final, direct-transfer payments — there is no escrow
  // to release or refund, so those controls must never show for them.
  const isEscrowBooking = booking.source === "agent";
  const refundEligibleAt = new Date(
    new Date(booking.createdAt).getTime() + (config?.refundDelaySeconds ?? 0) * 1000,
  );
  const canRefund =
    isBuyer &&
    isEscrowBooking &&
    booking.status === "paid" &&
    Date.now() >= refundEligibleAt.getTime();

  const releaseCalls =
    escrowReady && config
      ? buildReleaseCalls({
          escrowAddress: config.escrowAddress!,
          bookingId: booking.escrowBookingId as `0x${string}`,
        })
      : [];
  const refundCalls =
    escrowReady && config
      ? buildRefundCalls({
          escrowAddress: config.escrowAddress!,
          bookingId: booking.escrowBookingId as `0x${string}`,
        })
      : [];

  const onReleaseSuccess = (response: any) => {
    const releaseTxHash = response.transactionReceipts?.[0]?.transactionHash as string;
    if (!releaseTxHash) return;
    completeBooking.mutate(
      { id, data: { releaseTxHash } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBookingQueryKey(id) });
          toast({ title: "Released. Money's yours." });
        },
        onError: (err: any) =>
          toast({ title: "Server couldn't confirm", description: err?.data?.error ?? "Refresh and try again.", variant: "destructive" }),
      },
    );
  };

  const onRefundSuccess = (response: any) => {
    const refundTxHash = response.transactionReceipts?.[0]?.transactionHash as string;
    if (!refundTxHash) return;
    refundBooking.mutate(
      { id, data: { refundTxHash } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBookingQueryKey(id) });
          toast({ title: "Refunded. USDC's back." });
        },
        onError: (err: any) =>
          toast({ title: "Server couldn't confirm", description: err?.data?.error ?? "Refresh and try again.", variant: "destructive" }),
      },
    );
  };

  const channel = booking.channel;
  const channelLabel = channel === "messaging" ? "Messaging" : "Call";
  const ChannelIcon = channel === "messaging" ? MessageSquare : Calendar;

  return (
    <div className="container max-w-3xl mx-auto px-4 py-12">
      <Helmet><title>Booking #{booking.id.slice(0, 8)}</title></Helmet>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-2">
            // Booking #{booking.id.slice(0, 8)} · {channelLabel}
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-[-0.02em]">
            With @{booking.expertHandle}
          </h1>
          <div className="mt-3"><StatusPill status={booking.status} /></div>
        </div>

        <div className="flex flex-wrap gap-3">
          {isExpert && booking.status === "paid" && escrowReady && isEscrowBooking && (
            <Transaction
              chainId={config!.chainId}
              calls={releaseCalls}
              onSuccess={onReleaseSuccess}
              onError={(e) => toast({ title: "Release failed", description: e?.message, variant: "destructive" })}
            >
              <TransactionButton
                className="bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] h-11 px-5 font-display font-bold shadow-[5px_5px_0_var(--db-ink)]"
                text={completeBooking.isPending ? "Confirming…" : "Release escrow"}
              />
              <TransactionStatus><TransactionStatusLabel /><TransactionStatusAction /></TransactionStatus>
            </Transaction>
          )}
          {canRefund && escrowReady && (
            <Transaction
              chainId={config!.chainId}
              calls={refundCalls}
              onSuccess={onRefundSuccess}
              onError={(e) => toast({ title: "Refund failed", description: e?.message, variant: "destructive" })}
            >
              <TransactionButton
                className="bg-db-honey text-db-ink border-[2.5px] border-db-ink rounded-[16px] h-11 px-5 font-display font-bold shadow-[5px_5px_0_var(--db-ink)]"
                text={refundBooking.isPending ? "Confirming…" : "Claim refund"}
              />
              <TransactionStatus><TransactionStatusLabel /><TransactionStatusAction /></TransactionStatus>
            </Transaction>
          )}
          {isBuyer && isEscrowBooking && booking.status === "paid" && !canRefund && (
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute">
              Refund unlocks {refundEligibleAt.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        {/* Reveal panel (buyer-only) */}
        {isBuyer && (
          <div className="p-8 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]" data-testid="reveal-panel">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-[12px] bg-db-bg-alt border-[2.5px] border-db-ink flex items-center justify-center shrink-0">
                <ChannelIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">// Step 2</div>
                <h3 className="font-display text-2xl font-bold">
                  {channel === "messaging" ? "Open the DM." : "Pick a slot."}
                </h3>
              </div>
            </div>

            {!revealed && (
              <p className="text-db-mute font-mono text-sm">Pulling contact…</p>
            )}

            {revealed && channel === "messaging" && revealed.handle && revealed.platform && (
              <div className="space-y-4">
                <p className="text-db-mute">
                  {expert?.name ?? "The seller"} is on{" "}
                  <strong className="text-db-ink">{revealed.platform === "whatsapp" ? "WhatsApp" : "Telegram"}</strong>.
                  Message them directly — escrow is already on your side.
                </p>
                <div className="flex items-center gap-3 p-4 bg-db-bg-alt border-[2.5px] border-db-ink rounded-[16px]">
                  <div className="flex-1 min-w-0 font-mono text-sm truncate" data-testid="text-reveal-handle">
                    {revealed.platform === "whatsapp" ? revealed.handle : `@${revealed.handle.replace(/^@/, "")}`}
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
                <a
                  href={messagingDeepLink(revealed.platform, revealed.handle)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center px-6 bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] font-display font-bold shadow-[5px_5px_0_var(--db-ink)]"
                  data-testid="link-open-messaging"
                >
                  Open {revealed.platform === "whatsapp" ? "WhatsApp" : "Telegram"} <ExternalLink className="ml-2 w-4 h-4" />
                </a>
              </div>
            )}

            {revealed && channel === "calls" && revealed.bookingUrl && (
              <div className="space-y-4">
                <p className="text-db-mute">The seller's booking link — pick a time that works.</p>
                <a
                  href={revealed.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center px-6 bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] font-display font-bold shadow-[5px_5px_0_var(--db-ink)]"
                  data-testid="link-open-booking-url"
                >
                  Open booking link <ExternalLink className="ml-2 w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        )}

        {isExpert && (
          <div className="p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg-alt">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute mb-2">// You're the seller</div>
            <p className="text-db-ink">
              Your buyer unlocked your {channel === "messaging" ? "messaging handle" : "booking link"}.
              {isEscrowBooking ? (
                <> When you've delivered, hit <strong>Release escrow</strong> to take payment.</>
              ) : (
                <> Payment already landed in your wallet, just deliver.</>
              )}
            </p>
          </div>
        )}

        <div className="p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-4">// The receipt</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute mb-1">Paid</div>
              <div className="font-display text-2xl font-bold">${fmtUsdc(booking.amountUsdc)} <span className="font-mono text-xs text-db-mute">USDC</span></div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute mb-1">Platform fee</div>
              <div className="font-display text-2xl font-bold">${fmtUsdc(booking.feeUsdc)} <span className="font-mono text-xs text-db-mute">USDC</span></div>
            </div>
            <div className="col-span-2 mt-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute mb-1">Booking tx</div>
              <a
                href={`${config?.explorerBaseUrl}/tx/${booking.bookTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-mono text-xs text-db-cobalt hover:underline break-all"
              >
                {booking.bookTxHash} <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
            {booking.releaseTxHash && (
              <div className="col-span-2">
                <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute mb-1">Release tx</div>
                <a href={`${config?.explorerBaseUrl}/tx/${booking.releaseTxHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-mono text-xs text-db-cobalt hover:underline break-all">
                  {booking.releaseTxHash} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </div>
            )}
            {booking.refundTxHash && (
              <div className="col-span-2">
                <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute mb-1">Refund tx</div>
                <a href={`${config?.explorerBaseUrl}/tx/${booking.refundTxHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-mono text-xs text-db-cobalt hover:underline break-all">
                  {booking.refundTxHash} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          {isExpert && booking.status === "completed" && (
            <div className="db-pill forest">
              <CheckCircle2 className="w-3 h-3" /> Released
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
