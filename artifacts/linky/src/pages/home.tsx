import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useGetPlatformStats } from "@workspace/api-client-react";
import { ArrowRight } from "lucide-react";
import baseAppIcon from "../assets/base-app-icon.png";

const TICKER_ITEMS = [
  "ACCESS HIDDEN INTELLIGENCE",
  "ON-CHAIN",
  "INSTANT USDC SETTLEMENT",
  "FOR HUMANS",
  "FOR AGENTS",
  "ESCROWED, NOT TRUSTED",
  "REFUND IF NO ANSWER",
  "SETTLED ON BASE",
];

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="db-ticker">
      <div className="db-ticker-track">
        {items.map((item, i) => (
          <span key={i} className="db-ticker-item">
            <span className="db-ticker-dot" /> {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatBlock({ label, value, prefix = "" }: { label: string; value: string | number; prefix?: string }) {
  return (
    <div className="flex flex-col gap-2 p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute">{label}</span>
      <span className="font-display text-4xl font-bold tracking-tight">
        {prefix}{value.toLocaleString()}
      </span>
    </div>
  );
}

export default function Home() {
  const { data: stats } = useGetPlatformStats();

  return (
    <>
      <Helmet>
        <title>LINKY — Human intelligence, on-chain</title>
        <meta name="description" content="Claim your handle. Get your personal LINKY link. Share it with your audience. Collect USDC — settled on Base." />
        <meta property="og:title" content="LINKY — Human intelligence, on-chain" />
        <meta property="og:description" content="Claim your handle. Get your personal LINKY link. Share it with your audience. Collect USDC — settled on Base." />
        <meta property="og:image" content="/og-home.png" />
      </Helmet>
      <section className="container max-w-6xl mx-auto px-4 pt-16 pb-10 md:pt-24 md:pb-16">
        <div className="flex flex-col items-start gap-6">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-ink bg-db-bg-alt border-[2.5px] border-db-ink rounded-full px-3 py-1 shadow-[3px_3px_0_var(--db-ink)]">
              ★ Settled on Base
            </span>
            <img
              src={baseAppIcon}
              alt="Base"
              className="h-7 w-7 shrink-0"
            />
          </div>
          <h1 className="font-display font-bold tracking-[-0.02em] leading-[1.02] text-5xl sm:text-6xl md:text-7xl lg:text-8xl max-w-4xl">
            Human intelligence,<br/>
            <span className="text-db-cobalt">on-chain.</span>
          </h1>
          <p className="font-body text-lg md:text-xl text-db-ink/80 max-w-2xl leading-snug">Your knowledge has a price. Set it. Publish one link. Share your contact details directly with the people and agents who value what you know. Instant payments in USDC, cleared on Base.</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-ink bg-db-bg-alt border-[2.5px] border-db-ink rounded-full px-3 py-1 shadow-[2px_2px_0_var(--db-ink)]">
              For humans
            </span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-ink bg-db-bg-alt border-[2.5px] border-db-ink rounded-full px-3 py-1 shadow-[2px_2px_0_var(--db-ink)]">
              For agents
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mt-2">
            <Link
              href="/new"
              className="inline-flex h-12 sm:h-14 items-center justify-center gap-2 px-6 sm:px-7 bg-db-cobalt border-[2.5px] border-db-ink rounded-[16px] font-display font-bold text-base shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--db-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--db-ink)] transition-[transform,box-shadow] text-white"
            >
              Claim your handle <ArrowRight className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-4 sm:gap-4">
              <Link
                href="/dashboard"
                className="font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-db-ink hover:text-db-cobalt underline-offset-4 hover:underline"
              >
                I already have one
              </Link>
              <span className="text-db-ink/30 hidden sm:inline">·</span>
              <Link
                href="/how-it-works"
                className="font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-db-ink/60 hover:text-db-cobalt underline-offset-4 hover:underline"
              >
                How it works →
              </Link>
            </div>
          </div>
        </div>
      </section>
      <Ticker />
      <section className="container max-w-6xl mx-auto px-4 py-16">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-6">
          // The receipts
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats ? (
            <>
              <StatBlock label="Volume on Base" value={Number(stats.totalVolumeUsdc)} prefix="$" />
              <StatBlock label="Knowledge Transmitted" value={stats.totalBookings} />
              <StatBlock label="Links Generated" value={stats.totalLinks} />
            </>
          ) : (
            <>
              <StatBlock label="Volume on Base" value={0} prefix="$" />
              <StatBlock label="Knowledge Transmitted" value={0} />
              <StatBlock label="Links Generated" value={0} />
            </>
          )}
        </div>
        <blockquote className="mt-10 border-l-[4px] border-db-cobalt pl-6 max-w-2xl">
          <p className="font-display text-xl md:text-2xl font-bold leading-snug tracking-[-0.01em] text-db-ink">
            Buy an expert answer in USDC. Settled on Base.<br />
            <span className="text-db-cobalt">One link. One price. Get the access.</span>
          </p>
          <p className="mt-3 font-body text-base text-db-ink/70 leading-relaxed">
            World class human intelligence is locked away in the brain. LINKY makes it accessible. One link, one payment, direct access to the tacit knowledge most people will never reach.
          </p>
        </blockquote>
      </section>
    </>
  );
}
