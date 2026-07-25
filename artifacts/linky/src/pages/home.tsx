import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useGetPlatformStats } from "@workspace/api-client-react";
import { ArrowRight, Bot, Lock, ShieldCheck, Zap } from "lucide-react";
import { CountUp } from "@/components/count-up";
import baseAppIcon from "../assets/base-app-icon.png";

const TICKER_ITEMS = [
  "THE HUMAN LAYER FOR AI",
  "PAID IN USDC",
  "FOR AGENTS",
  "FOR HUMANS",
  "INSTANT SETTLEMENT",
  "ON BASE",
  "JUDGMENT, NOT GUESSES",
  "YOUR EXPERTISE, AN ENDPOINT",
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

// A stylised, illustrative "incoming agent request" card. Not live data —
// it makes the agentic use-case tangible on first glance.
function RequestCard() {
  return (
    <div className="w-full max-w-sm border-[2.5px] border-db-ink rounded-[20px] bg-db-bg shadow-[7px_7px_0_var(--db-ink)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b-[2.5px] border-db-ink bg-db-ink">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-db-bg">
          Incoming request
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-db-bg">
          <span className="h-2 w-2 rounded-full bg-db-honey animate-pulse" /> live
        </span>
      </div>
      <div className="px-5 py-5 flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full border-[2px] border-db-ink bg-db-cobalt flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-db-ink truncate">
              research-agent.base.eth
            </div>
            <div className="font-mono text-[11px] text-db-mute">needs a human to verify</div>
          </div>
        </div>
        <div className="flex items-baseline justify-between border-t border-db-ink/15 pt-3.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute">
            Offer
          </span>
          <span className="font-display text-3xl font-bold tracking-[-0.02em] text-db-ink">
            $25.00
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 h-11 rounded-[12px] bg-db-honey border-[2.5px] border-db-ink font-display font-bold text-sm text-db-ink shadow-[3px_3px_0_var(--db-ink)]">
          Accept · paid instantly <Zap className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function WhyCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Bot;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-3 p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]">
      <div className="h-11 w-11 rounded-[12px] border-[2px] border-db-ink bg-db-bg-alt flex items-center justify-center">
        <Icon className="h-5 w-5 text-db-cobalt" />
      </div>
      <h3 className="font-display text-xl font-bold tracking-[-0.01em] leading-tight">{title}</h3>
      <p className="font-body text-[15px] text-db-ink/70 leading-relaxed">{body}</p>
    </div>
  );
}

function StatBlock({
  label,
  value,
  prefix = "",
  decimals = 0,
}: {
  label: string;
  value: number;
  prefix?: string;
  decimals?: number;
}) {
  return (
    <div className="flex flex-col gap-2 p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute">{label}</span>
      <span className="font-display text-4xl font-bold tracking-tight">
        <CountUp end={value} prefix={prefix} decimals={decimals} />
      </span>
    </div>
  );
}

export default function Home() {
  const { data: stats } = useGetPlatformStats();

  return (
    <>
      <Helmet>
        <title>LINKY — Human in the loop</title>
        <meta
          name="description"
          content="Human in the loop, paid in USDC. When AI quality needs genuine human expertise, LINKY is the loop: experts get paid on Base for the judgment AI can't generate."
        />
        <meta property="og:title" content="LINKY — Human in the loop" />
        <meta
          property="og:description"
          content="Human in the loop. Paid in USDC. Experts get paid when AI needs genuine expertise. Settled on Base."
        />
        <meta property="og:image" content="/og-home.png" />
      </Helmet>

      {/* Hero */}
      <section className="container max-w-6xl mx-auto px-4 pt-14 pb-10 md:pt-20 md:pb-16">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-8 items-center">
          <div className="flex flex-col items-start gap-6">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-ink bg-db-bg-alt border-[2.5px] border-db-ink rounded-full px-3 py-1 shadow-[3px_3px_0_var(--db-ink)]">
                ★ Human in the loop
              </span>
              <img src={baseAppIcon} alt="Base" className="h-7 w-7 shrink-0" />
            </div>

            <h1 className="font-display font-bold tracking-[-0.02em] leading-[1.02] text-5xl sm:text-6xl md:text-7xl max-w-3xl">
              Human in the loop.<br />
              Paid in <span className="text-db-cobalt">USDC.</span>
            </h1>

            <p className="font-body text-lg md:text-xl text-db-ink/80 max-w-2xl leading-snug">
              When AI quality needs genuine human expertise, LINKY is the loop. Experts articulate the
              knowledge value they hold, AI calls on them, experts get paid. The AI agents that hit
              their limits pay for the judgment they can't generate. Settled instantly on Base.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {["For experts", "For AI agents", "Instant USDC", "On Base"].map((t) => (
                <span
                  key={t}
                  className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-ink bg-db-bg-alt border-[2.5px] border-db-ink rounded-full px-3 py-1 shadow-[2px_2px_0_var(--db-ink)]"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mt-2">
              <Link
                href="/new"
                className="inline-flex h-12 sm:h-14 items-center justify-center gap-2 px-6 sm:px-7 bg-db-cobalt border-[2.5px] border-db-ink rounded-[16px] font-display font-bold text-base shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--db-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--db-ink)] transition-[transform,box-shadow] text-white"
              >
                Claim your handle <ArrowRight className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-4">
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
                <span className="text-db-ink/30 hidden sm:inline">·</span>
                <Link
                  href="/docs/agents"
                  className="font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-db-ink/60 hover:text-db-cobalt underline-offset-4 hover:underline"
                >
                  For agents & builders →
                </Link>
              </div>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <RequestCard />
          </div>
        </div>
      </section>

      <Ticker />

      {/* Why agents pay humans */}
      <section className="container max-w-6xl mx-auto px-4 py-16 md:py-20">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-3">
          // Why agents pay humans
        </div>
        <h2 className="font-display font-bold text-3xl md:text-4xl tracking-[-0.02em] leading-[1.05] max-w-2xl mb-10">
          A model can write anything. It still can't <span className="text-db-cobalt">be</span> you.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <WhyCard
            icon={ShieldCheck}
            title="Judgment, not guesses"
            body="An agent can produce text. It can't be accountable for it. You can. Agents pay for a human who will stake their name on the answer."
          />
          <WhyCard
            icon={Lock}
            title="Knowledge that isn't online"
            body="The best context was never scraped. Your private, hard-won expertise is exactly what a model has no way to reach."
          />
          <WhyCard
            icon={Zap}
            title="Verification and sign-off"
            body="When an agent needs a human to check its work, approve a step, or unblock it, your yes is worth paying for."
          />
        </div>
      </section>

      {/* Agent-ready strip */}
      <section className="container max-w-6xl mx-auto px-4 pb-16 md:pb-20">
        <div className="border-[2.5px] border-db-ink rounded-[20px] bg-db-ink text-db-bg shadow-[6px_6px_0_var(--db-cobalt)] overflow-hidden">
          <div className="grid md:grid-cols-[1fr_auto] gap-6 md:gap-10 items-center px-7 py-8 md:px-10 md:py-10">
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-db-honey">
                Agent-ready by default
              </span>
              <h2 className="font-display font-bold text-2xl md:text-3xl tracking-[-0.02em] leading-tight">
                Every link is also an endpoint.
              </h2>
              <p className="font-body text-[15px] md:text-base text-db-bg/70 leading-relaxed max-w-xl">
                Agents pay with a single signed USDC request. No account, no invoice, no waiting.
                Your expertise becomes an API that pays you the moment it is used.
              </p>
            </div>
            <div className="font-mono text-[13px] md:text-sm rounded-[14px] border-[2px] border-db-bg/25 bg-black/30 px-5 py-4 whitespace-nowrap self-start md:self-center">
              <span className="text-db-mute">POST</span> <span className="text-db-bg">/ask</span>
              <br />
              <span className="text-db-honey">25.00 USDC</span>{" "}
              <span className="text-db-mute">· settled on Base</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container max-w-6xl mx-auto px-4 pb-20">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-6">
          // The receipts
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatBlock
            label="Volume on Base"
            value={stats ? Number(stats.totalVolumeUsdc) : 0}
            prefix="$"
            decimals={2}
          />
          <StatBlock label="Answers delivered" value={stats ? stats.totalBookings : 0} />
          <StatBlock label="Links generated" value={stats ? stats.totalLinks : 0} />
        </div>
        <blockquote className="mt-12 border-l-[4px] border-db-cobalt pl-6 max-w-2xl">
          <p className="font-display text-xl md:text-2xl font-bold leading-snug tracking-[-0.01em] text-db-ink">
            The last mile of intelligence is human.
            <br />
            <span className="text-db-cobalt">LINKY is where the agentic economy pays for it.</span>
          </p>
          <p className="mt-3 font-body text-base text-db-ink/70 leading-relaxed">
            Set your price. Publish one link. Get paid in USDC the moment a person, or the agent
            working for them, needs what only you know.
          </p>
        </blockquote>
      </section>
    </>
  );
}
