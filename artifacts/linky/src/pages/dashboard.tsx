import { Helmet } from "react-helmet-async";
import { useAccount } from "wagmi";
import {
  useGetExpertByWallet,
  useGetExpertStats,
  useListBookingsByExpert,
  useCompleteBooking,
  useGetConfig,
  getGetExpertByWalletQueryKey,
  getListBookingsByExpertQueryKey,
  getGetExpertStatsQueryKey,
} from "@workspace/api-client-react";
import { Wallet, ConnectWallet } from "@coinbase/onchainkit/wallet";
import { Avatar, Name } from "@coinbase/onchainkit/identity";
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from "@coinbase/onchainkit/transaction";
import { Copy, MessageSquare, Lock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { buildReleaseCalls } from "@/lib/escrow";
import { fmtUsdc } from "@/lib/fmt";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-2">
        {label}
      </div>
      <div className="font-display text-4xl font-bold tracking-[-0.02em]">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    completed: { cls: "bg-db-forest text-db-cream", label: "Released" },
    refunded: { cls: "bg-db-honey text-db-ink", label: "Refunded" },
    paid: { cls: "bg-db-cobalt text-db-cream", label: "In escrow" },
  };
  const s = map[status] ?? { cls: "bg-db-bg-alt text-db-ink", label: status };
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border-[2.5px] border-db-ink font-mono text-[10px] font-semibold uppercase tracking-[0.08em] shadow-[3px_3px_0_var(--db-ink)] ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, signIn, isSigningIn } = useAuth();

  const { data: expert, isLoading: isExpertLoading } = useGetExpertByWallet(address || "", {
    query: {
      enabled: !!address && isAuthenticated,
      queryKey: getGetExpertByWalletQueryKey(address || ""),
    },
  });

  const { data: stats } = useGetExpertStats(expert?.handle || "", {
    query: {
      enabled: !!expert?.handle,
      queryKey: getGetExpertStatsQueryKey(expert?.handle || ""),
    },
  });

  const { data: bookings, isLoading: isBookingsLoading } = useListBookingsByExpert(
    expert?.wallet || "",
    {
      query: {
        enabled: !!expert?.wallet,
        queryKey: getListBookingsByExpertQueryKey(expert?.wallet || ""),
      },
    },
  );

  const { data: config } = useGetConfig();
  const completeBooking = useCompleteBooking();

  const handleCopyLink = () => {
    if (!expert) return;
    const url = `${window.location.origin}/${expert.handle}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Now go post it somewhere." });
  };

  if (!isConnected) {
    return (
      <div className="container max-w-lg mx-auto px-4 py-24 flex flex-col items-start gap-6">
        <Helmet><title>Dashboard — LINKY</title></Helmet>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">
          // Step 1
        </span>
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em]">Plug in your wallet.</h1>
        <p className="text-db-mute">The same one you used to claim your handle.</p>
        <Wallet>
          <ConnectWallet className="border-[2.5px] border-db-ink bg-db-cobalt text-db-cream rounded-[16px] h-12 px-6 font-display font-bold shadow-[5px_5px_0_var(--db-ink)]">
            <Avatar className="h-5 w-5" />
            <Name />
          </ConnectWallet>
        </Wallet>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container max-w-lg mx-auto px-4 py-24 flex flex-col items-start gap-6">
        <Helmet><title>Sign in — Dashboard</title></Helmet>
        <span className="db-pill ink"><Lock className="w-3 h-3" /> Private</span>
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em]">Sign in to peek inside.</h1>
        <p className="text-db-mute">One signature. No gas. Proves the wallet is yours.</p>
        <Button onClick={signIn} disabled={isSigningIn} size="lg">
          {isSigningIn ? "Signing..." : "Sign in"}
        </Button>
      </div>
    );
  }

  if (isExpertLoading)
    return <div className="p-8 text-center font-mono uppercase tracking-[0.08em] text-db-mute">Loading...</div>;

  if (!expert) {
    return (
      <div className="container max-w-lg mx-auto px-4 py-24 flex flex-col items-start gap-6">
        <Helmet><title>Dashboard — LINKY</title></Helmet>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute">// 404 — wallet</span>
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em]">No LINKY on this wallet.</h1>
        <p className="text-db-mute">Make one. Takes 60 seconds. Yes really.</p>
        <Link
          href="/new"
          className="inline-flex h-12 items-center justify-center px-6 bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] font-display font-bold shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--db-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--db-ink)] transition-[transform,box-shadow]"
        >
          Claim a handle
        </Link>
      </div>
    );
  }

  const escrowReady = !!config?.escrowAddress;

  return (
    <div className="container max-w-6xl mx-auto px-4 py-12">
      <Helmet><title>Dashboard — @{expert.handle}</title></Helmet>

      <div className="mb-8">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-2">
          // @{expert.handle}
        </div>
        <h1 className="font-display text-5xl font-bold tracking-[-0.02em]">Your booth.</h1>
        <p className="text-db-mute mt-2">Bookings come in. You answer. Money lands.</p>
      </div>

      <div className="w-full p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg-alt shadow-[5px_5px_0_var(--db-ink)] mb-12 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-1">
            // Your link
          </div>
          <div className="font-mono text-xl font-semibold tracking-tight truncate">
            linky.so/{expert.handle}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="ink" onClick={handleCopyLink}>
            <Copy className="h-4 w-4" /> Copy link
          </Button>
          <a
            href={`/${expert.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm underline decoration-dotted text-db-mute hover:text-db-ink transition-colors whitespace-nowrap"
          >
            Preview your page →
          </a>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <Stat label="Total earned" value={`$${Number(stats.totalEarnedUsdc).toLocaleString()}`} />
          <Stat label="Released" value={String(stats.completedBookings)} />
          <Stat label="Messaging unlocks" value={String(stats.messagingBookings)} />
          <Stat label="Calls booked" value={String(stats.callsBookings)} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-2">// Messaging channel</div>
          {expert.messaging ? (
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="font-display text-xl font-bold capitalize">{expert.messaging.platform}</div>
                <div className="font-mono text-xs text-db-mute mt-1">{stats?.messagingBookings ?? 0} unlocks</div>
              </div>
              <div className="text-right">
                <div className="font-display text-3xl font-bold tracking-[-0.02em]">${fmtUsdc(expert.messaging.priceUsdc)}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-db-mute">per unlock</div>
              </div>
            </div>
          ) : (
            <p className="text-db-mute text-sm">Off. Turn it on to start charging for DMs.</p>
          )}
        </div>
        <div className="p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-2">// Calls channel</div>
          {expert.calls ? (
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="font-display text-xl font-bold">Calendar link</div>
                <div className="font-mono text-xs text-db-mute mt-1">{stats?.callsBookings ?? 0} booked</div>
              </div>
              <div className="text-right">
                <div className="font-display text-3xl font-bold tracking-[-0.02em]">${fmtUsdc(expert.calls.priceUsdc)}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-db-mute">per call</div>
              </div>
            </div>
          ) : (
            <p className="text-db-mute text-sm">Off. Turn it on to sell calls.</p>
          )}
        </div>
      </div>

      <div className="mb-8">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-2">
          // The inbox
        </div>
        <h2 className="font-display text-3xl font-bold tracking-[-0.02em] mb-6">Recent bookings</h2>

        {isBookingsLoading ? (
          <div className="font-mono uppercase tracking-[0.08em] text-db-mute">Loading...</div>
        ) : !bookings || bookings.length === 0 ? (
          <div className="text-center py-20 border-[2.5px] border-dashed border-db-ink rounded-[16px] bg-db-bg-alt">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute mb-3">// Empty</div>
            <h3 className="font-display text-2xl font-bold mb-2">Nothing here yet.</h3>
            <p className="text-db-mute mb-6">Post your link. Bookings follow.</p>
            <Button onClick={handleCopyLink} variant="outline">Copy my link</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const releaseCalls =
                escrowReady && config
                  ? buildReleaseCalls({
                      escrowAddress: config.escrowAddress!,
                      bookingId: booking.escrowBookingId as `0x${string}`,
                    })
                  : [];
              return (
                <div
                  key={booking.id}
                  className="flex flex-col sm:flex-row gap-4 p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)] items-start sm:items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="font-mono text-xs bg-db-bg-alt border-[2.5px] border-db-ink px-2 py-0.5 rounded-full">
                        {booking.buyerWallet.slice(0, 6)}…{booking.buyerWallet.slice(-4)}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] bg-db-bg-alt border-[2.5px] border-db-ink px-2 py-0.5 rounded-full">
                        {booking.channel === "messaging" ? "DM" : "Call"}
                      </span>
                      {booking.source === "agent" && (
                        <span
                          title="Booked by an AI agent via /v1/ask"
                          className="font-mono text-[10px] uppercase tracking-[0.08em] bg-db-honey text-db-ink border-[2.5px] border-db-ink px-2 py-0.5 rounded-full"
                        >
                          Agent
                        </span>
                      )}
                      <StatusPill status={booking.status} />
                    </div>
                    <div className="font-display text-2xl font-bold">${fmtUsdc(booking.amountUsdc)} <span className="font-mono text-xs text-db-mute">USDC</span></div>
                    <div className="text-sm text-db-mute mt-1 font-mono">
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Link href={`/booking/${booking.id}`} className="flex-1 sm:flex-none">
                      <Button variant="outline" size="default" className="w-full">
                        <MessageSquare className="h-4 w-4" /> Open
                      </Button>
                    </Link>
                    {booking.status === "paid" && escrowReady && (
                      <Transaction
                        chainId={config!.chainId}
                        calls={releaseCalls}
                        onSuccess={(response) => {
                          const releaseTxHash = response.transactionReceipts?.[0]?.transactionHash as string;
                          if (!releaseTxHash) return;
                          completeBooking.mutate(
                            { id: booking.id, data: { releaseTxHash } },
                            {
                              onSuccess: () => {
                                queryClient.invalidateQueries({
                                  queryKey: getListBookingsByExpertQueryKey(expert.wallet),
                                });
                                queryClient.invalidateQueries({
                                  queryKey: getGetExpertStatsQueryKey(expert.handle),
                                });
                                toast({ title: "Released. Money's yours." });
                              },
                              onError: (err: any) =>
                                toast({
                                  title: "Server couldn't confirm",
                                  description: err?.data?.error ?? "Refresh and try again.",
                                  variant: "destructive",
                                }),
                            },
                          );
                        }}
                        onError={(e) =>
                          toast({
                            title: "Release failed",
                            description: e?.message,
                            variant: "destructive",
                          })
                        }
                      >
                        <TransactionButton
                          className="flex-1 sm:flex-none h-11 px-5 rounded-[16px] bg-db-cobalt text-db-cream border-[2.5px] border-db-ink font-display font-bold text-sm shadow-[5px_5px_0_var(--db-ink)]"
                          text="Release"
                        />
                        <TransactionStatus>
                          <TransactionStatusLabel />
                          <TransactionStatusAction />
                        </TransactionStatus>
                      </Transaction>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
