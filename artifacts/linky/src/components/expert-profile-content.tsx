import { Helmet } from "react-helmet-async";
import { useState } from "react";
import {
  useGetExpert,
  useGetExpertStats,
  useGetConfig,
  useCreateBooking,
  useRevealExpertContact,
  getGetExpertQueryKey,
  getGetExpertStatsQueryKey,
  getRevealExpertContactQueryKey,
} from "@workspace/api-client-react";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { randomBookingId } from "@/lib/escrow";
import { fmtUsdc } from "@/lib/fmt";
import { PaySheet } from "@/components/pay-sheet";
import {
  MessageSquare,
  Calendar,
  Linkedin,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import NotFound from "@/pages/not-found";

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

function ChannelCard({
  expertHandle,
  channel,
  icon: Icon,
  title,
  subtitle,
  priceUsdc,
  onPay,
}: {
  expertHandle: string;
  channel: Channel;
  icon: typeof MessageSquare;
  title: string;
  subtitle: string;
  priceUsdc: string;
  onPay: () => void;
}) {
  const { isAuthenticated } = useAuth();
  const { isConnected } = useAccount();

  // Surface the revealed state on the card itself (so a returning buyer sees
  // "Unlocked — Open" without needing to open the sheet). The sheet is still
  // the canonical place to open the contact.
  const { data: revealed } = useRevealExpertContact(expertHandle, channel, {
    query: {
      enabled: isAuthenticated && isConnected,
      queryKey: getRevealExpertContactQueryKey(expertHandle, channel),
      retry: false,
      staleTime: 30_000,
    },
  });

  const isRevealed =
    !!revealed &&
    ((channel === "messaging" && !!revealed.handle && !!revealed.platform) ||
      (channel === "calls" && !!revealed.bookingUrl));

  const ctaText = isRevealed
    ? channel === "messaging"
      ? "Open contact"
      : "Open booking page"
    : `Pay $${fmtUsdc(priceUsdc)} to ${channel === "messaging" ? "unlock" : "book"}`;

  return (
    <button
      type="button"
      onClick={onPay}
      className="group w-full text-left p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px transition-transform"
      data-testid={`channel-${channel}`}
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-[12px] bg-db-bg-alt border-[2.5px] border-db-ink flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display text-xl font-bold leading-tight">
              {title}
            </div>
            <p className="text-sm text-db-mute mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          {isRevealed ? (
            <span className="db-pill forest">
              <CheckCircle2 className="w-3 h-3" /> Unlocked
            </span>
          ) : (
            <>
              <div className="font-display text-3xl font-bold tracking-[-0.02em]">
                ${fmtUsdc(priceUsdc)}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-db-mute">
                USDC
              </div>
            </>
          )}
        </div>
      </div>

      <div className="inline-flex h-12 w-full items-center justify-center px-6 bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] font-display font-bold shadow-[3px_3px_0_var(--db-ink)] group-hover:shadow-[2px_2px_0_var(--db-ink)] transition-shadow">
        {ctaText}
        <ArrowRight className="ml-2 w-4 h-4" />
      </div>
    </button>
  );
}

export function ExpertProfileContent({
  handle,
  inModal = false,
}: {
  handle: string;
  inModal?: boolean;
}) {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, signIn } = useAuth();

  const { data: expert, isError: isExpertError, isLoading: isExpertLoading } =
    useGetExpert(handle, {
      query: {
        enabled: !!handle,
        queryKey: getGetExpertQueryKey(handle),
        retry: false,
      },
    });

  const { data: stats } = useGetExpertStats(handle, {
    query: { enabled: !!handle, queryKey: getGetExpertStatsQueryKey(handle) },
  });

  const { data: config } = useGetConfig() as { data: PlatformConfig | undefined };
  const createBooking = useCreateBooking();

  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  // One booking id per attempt — regenerated each time the sheet opens.
  const [bookingIds, setBookingIds] = useState<Record<Channel, `0x${string}`>>(
    () => ({ messaging: randomBookingId(), calls: randomBookingId() }),
  );
  // Contact revealed by the create-booking response — unlocks instantly after
  // payment with no signed session required.
  type RevealData = {
    channel: Channel;
    platform: "whatsapp" | "telegram" | null;
    handle: string | null;
    bookingUrl: string | null;
  };
  const [freshReveal, setFreshReveal] = useState<Record<Channel, RevealData | undefined>>(
    () => ({ messaging: undefined, calls: undefined }),
  );

  // Always-on reveal queries so the sheet has fresh contact data the moment
  // it opens (driven by the auth-gated endpoint from task #7).
  const { data: messagingReveal } = useRevealExpertContact(handle, "messaging", {
    query: {
      enabled: !!handle && isAuthenticated && isConnected,
      queryKey: getRevealExpertContactQueryKey(handle, "messaging"),
      retry: false,
      staleTime: 30_000,
    },
  });
  const { data: callsReveal } = useRevealExpertContact(handle, "calls", {
    query: {
      enabled: !!handle && isAuthenticated && isConnected,
      queryKey: getRevealExpertContactQueryKey(handle, "calls"),
      retry: false,
      staleTime: 30_000,
    },
  });

  if (isExpertLoading)
    return (
      <div className="min-h-[40vh] flex items-center justify-center font-mono uppercase tracking-[0.08em] text-db-mute">
        Loading…
      </div>
    );

  if (isExpertError || !expert) {
    if (inModal)
      return (
        <div className="px-6 py-16 text-center font-mono uppercase tracking-[0.08em] text-db-mute">
          Couldn't load this expert.
        </div>
      );
    return <NotFound />;
  }

  const channels: Array<{
    kind: Channel;
    icon: typeof MessageSquare;
    title: string;
    subtitle: string;
    priceUsdc: string;
  }> = [];
  if (expert.messaging) {
    channels.push({
      kind: "messaging",
      icon: MessageSquare,
      title:
        expert.messaging.platform === "whatsapp"
          ? "Private message · WhatsApp"
          : "Private message · Telegram",
      subtitle: "Get a reply, usually within 24h.",
      priceUsdc: expert.messaging.priceUsdc,
    });
  }
  if (expert.calls) {
    channels.push({
      kind: "calls",
      icon: Calendar,
      title: "Calendar slot",
      subtitle: "Book a 1:1 call on their calendar.",
      priceUsdc: expert.calls.priceUsdc,
    });
  }

  const appUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://linky.so/${expert.handle}`;
  const headlinePrice = channels[0]?.priceUsdc ?? "0";

  const openSheet = (channel: Channel) => {
    // Refresh the booking id for this channel — every fresh open is a fresh
    // attempt so a previously failed/abandoned id never gets re-sent.
    setBookingIds((prev) => ({ ...prev, [channel]: randomBookingId() }));
    setActiveChannel(channel);
  };

  const handlePaid = (bookTxHash: string, channel: Channel, email: string) => {
    if (!expert) return;
    createBooking.mutate(
      {
        data: {
          expertHandle: expert.handle,
          channel,
          escrowBookingId: bookingIds[channel],
          bookTxHash,
          email,
        },
      },
      {
        onSuccess: (booking) => {
          // The contact comes back in the response — reveal it immediately.
          if (booking.reveal) {
            setFreshReveal((prev) => ({ ...prev, [channel]: booking.reveal as RevealData }));
          }
          queryClient.invalidateQueries({
            queryKey: getGetExpertStatsQueryKey(expert.handle),
          });
        },
        onError: (err: unknown) => {
          const msg =
            (err as { data?: { error?: string } } | null)?.data?.error ??
            "Server choked on the receipt.";
          toast({
            title: "Couldn't record that booking",
            description: msg + " Tap pay to retry.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div
      className={
        inModal
          ? "px-5 py-7 sm:px-8"
          : "container max-w-xl mx-auto px-4 py-10 md:py-16"
      }
    >
      {!inModal && (
        <Helmet>
          <title>{expert.name} on LINKY</title>
          <meta name="description" content={expert.about} />
          <meta property="og:title" content={`${expert.name} — Pay to speak`} />
          <meta
            property="og:description"
            content={`${expert.about} • from $${headlinePrice} USDC`}
          />
          <meta property="og:image" content="/og-expert.png" />
          {/* Agent discovery: an AI agent that lands on this profile via a link
              shared on X or LinkedIn can find the machine-readable record and
              the Agent API from these tags alone. */}
          <link
            rel="alternate"
            type="application/json"
            title="LINKY Agent API — expert record"
            href={`/api/v1/experts/${expert.handle}`}
          />
          <meta name="linky:expert-handle" content={expert.handle} />
          <meta name="linky:expert-wallet" content={expert.wallet} />
          <meta name="linky:agent-api" content="/api/v1/ask" />
          <meta name="linky:agent-docs" content="/docs/agents" />
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: expert.name,
              description: expert.about,
              url:
                typeof window !== "undefined" ? window.location.href : undefined,
              image: expert.avatarUrl ?? undefined,
              sameAs: [expert.linkedinUrl, expert.xUrl].filter(Boolean),
              identifier: expert.handle,
              potentialAction: {
                "@type": "BuyAction",
                name: "Ask via LINKY Agent API",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "/api/v1/ask",
                  httpMethod: "POST",
                  contentType: "application/json",
                  actionPlatform: "https://linky.so/docs/agents",
                },
                priceSpecification: {
                  "@type": "PriceSpecification",
                  price: headlinePrice,
                  priceCurrency: "USDC",
                },
              },
            })}
          </script>
          <meta
            name="fc:miniapp"
            content={JSON.stringify({
              version: "next",
              imageUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/og-expert.png`,
              button: {
                title: `Pay $${headlinePrice} to speak`,
                action: { type: "launch_miniapp", name: "LINKY", url: appUrl },
              },
            })}
          />
        </Helmet>
      )}

      {/* Identity block */}
      <div className="flex flex-col items-center text-center gap-4">
        {expert.avatarUrl ? (
          <img
            src={expert.avatarUrl}
            alt={expert.name}
            className="w-28 h-28 rounded-full object-cover border-[2.5px] border-db-ink shadow-[5px_5px_0_var(--db-ink)]"
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-db-cobalt text-db-cream border-[2.5px] border-db-ink shadow-[5px_5px_0_var(--db-ink)] flex items-center justify-center font-display font-bold text-5xl">
            {expert.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.02em] leading-[1.05]">
            {expert.name}
          </h1>
          <p className="mt-2 text-lg text-db-mute max-w-md mx-auto">
            {expert.about}
          </p>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mt-2">
            @{expert.handle}
          </div>
        </div>

        {(expert.linkedinUrl || expert.xUrl) && (
          <div className="flex items-center gap-2">
            {expert.linkedinUrl && (
              <a
                href={expert.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="inline-flex items-center justify-center w-10 h-10 border-[2.5px] border-db-ink rounded-full bg-db-bg shadow-[3px_3px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px transition-transform"
                data-testid="link-linkedin"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            )}
            {expert.xUrl && (
              <a
                href={expert.xUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="X"
                className="inline-flex items-center justify-center w-10 h-10 border-[2.5px] border-db-ink rounded-full bg-db-bg shadow-[3px_3px_0_var(--db-ink)] font-display font-bold text-sm hover:-translate-x-px hover:-translate-y-px transition-transform"
                data-testid="link-x"
              >
                𝕏
              </a>
            )}
          </div>
        )}

        {stats && stats.completedBookings > 0 && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="db-pill ink">★ {stats.completedBookings} answered</span>
            <span className="db-pill">
              ${Number(stats.totalEarnedUsdc).toLocaleString()} earned
            </span>
          </div>
        )}
      </div>

      {channels.length === 0 ? (
        <div className="mt-10 p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg-alt text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute">
            // Closed
          </div>
          <div className="font-display text-xl font-bold mt-1">
            This expert hasn't opened a channel yet.
          </div>
        </div>
      ) : (
        <>
          <div className="mt-10">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-2">
              // How to reach me
            </div>
            {channels.length > 1 && (
              <p className="font-display text-lg font-semibold mb-4">
                Pick how you want to connect with {expert.name}.
              </p>
            )}
          </div>
          <div className="grid gap-4">
            {channels.map((ch) => (
              <ChannelCard
                key={ch.kind}
                expertHandle={expert.handle}
                channel={ch.kind}
                icon={ch.icon}
                title={ch.title}
                subtitle={ch.subtitle}
                priceUsdc={ch.priceUsdc}
                onPay={() => openSheet(ch.kind)}
              />
            ))}
          </div>
          <div className="mt-3 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-db-mute">
              Paid directly to the expert · Payments are final
            </p>
          </div>
        </>
      )}

      {isConnected && !isAuthenticated && channels.length > 0 && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => signIn()}
            className="text-xs font-mono uppercase tracking-[0.08em] text-db-mute underline decoration-dotted"
          >
            Already paid? Sign in to unlock your contact.
          </button>
        </div>
      )}

      {address && <div className="sr-only">{address}</div>}

      {/* Pay sheet — one component owns the whole flow */}
      {activeChannel && (
        <PaySheet
          open={!!activeChannel}
          onOpenChange={(next) => {
            if (!next) setActiveChannel(null);
          }}
          expertHandle={expert.handle}
          expertName={expert.name}
          expertWallet={expert.wallet}
          expertAvatarUrl={expert.avatarUrl}
          channel={activeChannel}
          priceUsdc={
            activeChannel === "messaging"
              ? expert.messaging?.priceUsdc ?? "0"
              : expert.calls?.priceUsdc ?? "0"
          }
          config={config}
          bookingId={bookingIds[activeChannel]}
          revealed={
            freshReveal[activeChannel] ??
            (activeChannel === "messaging"
              ? (messagingReveal as RevealData | undefined)
              : (callsReveal as RevealData | undefined))
          }
          onPaid={handlePaid}
        />
      )}
    </div>
  );
}
