import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearch } from "wouter";
import { ArrowRight } from "lucide-react";

// ─── Mock-screenshot components ───────────────────────────────────────────────

function MockProfileCard() {
  return (
    <div className="border-[2.5px] border-db-ink rounded-[12px] bg-db-cream p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-db-cobalt border-[2px] border-db-ink shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-24 rounded bg-db-ink" />
          <div className="h-2 w-16 rounded bg-db-ink/30" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-2 w-full rounded bg-db-ink/20" />
        <div className="h-2 w-4/5 rounded bg-db-ink/20" />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-wide border-[1.5px] border-db-ink rounded-full px-2 py-0.5 bg-db-honey text-db-ink">
          Telegram · $20 USDC
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wide border-[1.5px] border-db-ink rounded-full px-2 py-0.5 bg-db-bg-alt text-db-ink">
          Call · $200 USDC
        </span>
      </div>
      <div className="h-7 rounded-[8px] bg-db-cobalt border-[1.5px] border-db-ink flex items-center justify-center">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-wide text-white">
          linky.so/yourname
        </span>
      </div>
    </div>
  );
}

function MockHandleClaim() {
  return (
    <div className="border-[2.5px] border-db-ink rounded-[12px] bg-db-cream p-4 space-y-3">
      <div className="font-mono text-[9px] uppercase tracking-wide text-db-mute">
        // Claim your handle
      </div>
      <div className="space-y-2">
        <div className="flex items-center border-[1.5px] border-db-ink rounded-[8px] bg-db-bg overflow-hidden">
          <span className="font-mono text-[10px] text-db-mute px-2 py-2 border-r-[1.5px] border-db-ink bg-db-bg-alt shrink-0">
            linky.so/
          </span>
          <span className="font-mono text-[10px] text-db-cobalt px-2 py-2">
            yourname
          </span>
          <div className="ml-auto px-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="h-2 w-12 rounded bg-db-ink/30" />
            <div className="h-7 rounded-[6px] border-[1.5px] border-db-ink bg-db-bg" />
          </div>
          <div className="space-y-1">
            <div className="h-2 w-16 rounded bg-db-ink/30" />
            <div className="h-7 rounded-[6px] border-[1.5px] border-db-ink bg-db-bg" />
          </div>
        </div>
        <div className="h-8 rounded-[8px] bg-db-cobalt border-[1.5px] border-db-ink shadow-[2px_2px_0_var(--db-ink)] flex items-center justify-center">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-wide text-white">
            Create my link →
          </span>
        </div>
      </div>
    </div>
  );
}

function MockShareLink() {
  return (
    <div className="border-[2.5px] border-db-ink rounded-[12px] bg-db-cream p-4 space-y-3">
      <div className="font-mono text-[9px] uppercase tracking-wide text-db-mute">
        // Your link is live
      </div>
      <div className="flex items-center gap-2 border-[1.5px] border-db-cobalt rounded-[8px] bg-db-cobalt/10 px-3 py-2">
        <span className="font-mono text-[10px] text-db-cobalt font-semibold flex-1">
          linky.so/yourname
        </span>
        <span className="font-mono text-[8px] uppercase tracking-wide border-[1.5px] border-db-cobalt rounded-full px-2 py-0.5 text-db-cobalt">
          Copy
        </span>
      </div>
      <div className="space-y-2">
        <div className="font-mono text-[9px] uppercase tracking-wide text-db-mute">
          Share to
        </div>
        <div className="flex gap-2">
          {["𝕏", "in", "✉"].map((icon, i) => (
            <div
              key={i}
              className="h-8 w-8 rounded-[6px] border-[1.5px] border-db-ink bg-db-bg-alt flex items-center justify-center font-bold text-[11px] shadow-[1px_1px_0_var(--db-ink)]"
            >
              {icon}
            </div>
          ))}
        </div>
      </div>
      <div className="h-2 w-3/4 rounded bg-db-ink/10" />
    </div>
  );
}

function MockBookingRequest() {
  return (
    <div className="border-[2.5px] border-db-ink rounded-[12px] bg-db-cream p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[9px] uppercase tracking-wide text-db-mute">
          // New booking request
        </div>
        <span className="font-mono text-[8px] uppercase tracking-wide bg-db-honey border-[1.5px] border-db-ink rounded-full px-2 py-0.5 text-db-ink">
          Funded
        </span>
      </div>
      <div className="border-[1.5px] border-db-ink rounded-[8px] bg-db-bg p-3 space-y-1.5">
        <div className="font-mono text-[9px] uppercase text-db-mute">Question</div>
        <div className="space-y-1">
          <div className="h-2 w-full rounded bg-db-ink/25" />
          <div className="h-2 w-5/6 rounded bg-db-ink/25" />
          <div className="h-2 w-2/3 rounded bg-db-ink/25" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-full bg-db-cobalt border-[1.5px] border-db-ink shrink-0" />
        <div className="h-2 w-20 rounded bg-db-ink/30" />
        <div className="ml-auto font-mono text-[9px] text-db-cobalt font-semibold">
          via Telegram
        </div>
      </div>
    </div>
  );
}

function MockGetPaid() {
  return (
    <div className="border-[2.5px] border-db-ink rounded-[12px] bg-db-cream p-4 space-y-3">
      <div className="font-mono text-[9px] uppercase tracking-wide text-db-mute">
        // Payment released
      </div>
      <div className="flex items-center justify-between border-[1.5px] border-db-ink rounded-[8px] bg-db-bg p-3">
        <div className="space-y-1">
          <div className="font-mono text-[9px] uppercase text-db-mute">Received</div>
          <div className="font-display font-bold text-xl tracking-tight text-db-cobalt">
            $19.00
          </div>
          <div className="font-mono text-[8px] text-db-mute">USDC · Base</div>
        </div>
        <div className="text-2xl">🎉</div>
      </div>
      <div className="flex gap-1.5">
        <div className="flex-1 h-1.5 rounded-full bg-db-cobalt" />
        <div className="w-4 h-1.5 rounded-full bg-db-ink/20" />
      </div>
      <div className="font-mono text-[8px] text-db-mute">
        1 of 5 answered this week
      </div>
    </div>
  );
}

// ── Buy-side mocks ─────────────────────────────────────────────────────────────

function MockFindExpert() {
  return (
    <div className="border-[2.5px] border-db-ink rounded-[12px] bg-db-cream p-4 space-y-3">
      <div className="font-mono text-[9px] uppercase tracking-wide text-db-mute">
        // linky.so/alexsmith
      </div>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-db-honey border-[2px] border-db-ink shrink-0" />
        <div className="space-y-1.5">
          <div className="h-3 w-20 rounded bg-db-ink" />
          <div className="h-2 w-28 rounded bg-db-ink/30" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-2 w-full rounded bg-db-ink/15" />
        <div className="h-2 w-5/6 rounded bg-db-ink/15" />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[8px] uppercase tracking-wide border-[1.5px] border-db-ink rounded-full px-2 py-0.5 bg-db-honey">
          Solidity · DeFi
        </span>
        <span className="font-mono text-[8px] uppercase tracking-wide border-[1.5px] border-db-ink rounded-full px-2 py-0.5 bg-db-bg-alt">
          Base
        </span>
      </div>
    </div>
  );
}

function MockPickChannel() {
  return (
    <div className="border-[2.5px] border-db-ink rounded-[12px] bg-db-cream p-4 space-y-3">
      <div className="font-mono text-[9px] uppercase tracking-wide text-db-mute">
        // Choose your access
      </div>
      <div className="space-y-2">
        <div className="border-[2px] border-db-cobalt rounded-[8px] bg-db-cobalt/10 p-3 flex items-center justify-between shadow-[2px_2px_0_var(--db-cobalt)]">
          <div>
            <div className="font-mono text-[9px] uppercase font-semibold text-db-cobalt">
              Telegram message
            </div>
            <div className="font-mono text-[8px] text-db-mute mt-0.5">
              Response within 48 h
            </div>
          </div>
          <div className="font-display font-bold text-base text-db-cobalt">
            $20
          </div>
        </div>
        <div className="border-[1.5px] border-db-ink rounded-[8px] bg-db-bg p-3 flex items-center justify-between opacity-60">
          <div>
            <div className="font-mono text-[9px] uppercase font-semibold">
              30-min call
            </div>
          </div>
          <div className="font-display font-bold text-base">$200</div>
        </div>
      </div>
      <div className="h-8 rounded-[8px] bg-db-cobalt border-[1.5px] border-db-ink shadow-[2px_2px_0_var(--db-ink)] flex items-center justify-center">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-wide text-white">
          Pay $20 USDC →
        </span>
      </div>
    </div>
  );
}

function MockExpertAnswers() {
  return (
    <div className="border-[2.5px] border-db-ink rounded-[12px] bg-db-cream p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-db-honey border-[1.5px] border-db-ink shrink-0" />
        <div className="flex-1 border-[1.5px] border-db-ink rounded-[8px] bg-db-bg p-2 space-y-1">
          <div className="h-2 w-full rounded bg-db-ink/20" />
          <div className="h-2 w-4/5 rounded bg-db-ink/20" />
          <div className="h-2 w-3/5 rounded bg-db-ink/20" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-db-cobalt border-[1.5px] border-db-ink shrink-0" />
        <div className="flex-1 border-[1.5px] border-db-cobalt rounded-[8px] bg-db-cobalt/10 p-2 space-y-1">
          <div className="h-2 w-full rounded bg-db-cobalt/30" />
          <div className="h-2 w-2/3 rounded bg-db-cobalt/30" />
        </div>
      </div>
      <div className="flex gap-1 items-center">
        <div className="h-1 w-1 rounded-full bg-db-mute/40 animate-pulse" />
        <div className="h-1 w-1 rounded-full bg-db-mute/40 animate-pulse" style={{ animationDelay: "0.2s" }} />
        <div className="h-1 w-1 rounded-full bg-db-mute/40 animate-pulse" style={{ animationDelay: "0.4s" }} />
        <span className="font-mono text-[8px] text-db-mute ml-1">Expert is typing…</span>
      </div>
    </div>
  );
}

function MockDone() {
  return (
    <div className="border-[2.5px] border-db-ink rounded-[12px] bg-db-cream p-4 space-y-3">
      <div className="font-mono text-[9px] uppercase tracking-wide text-db-mute">
        // Booking complete
      </div>
      <div className="flex items-center gap-3 border-[1.5px] border-db-ink rounded-[8px] bg-db-bg p-3">
        <div className="text-xl">✅</div>
        <div className="space-y-1">
          <div className="font-mono text-[9px] font-semibold uppercase">
            Answer received
          </div>
          <div className="h-2 w-24 rounded bg-db-ink/20" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-2 w-full rounded bg-db-ink/15" />
        <div className="h-2 w-4/5 rounded bg-db-ink/15" />
        <div className="h-2 w-3/5 rounded bg-db-ink/15" />
      </div>
      <div className="flex items-center justify-between">
        <div className="font-mono text-[8px] text-db-mute uppercase">USDC settled · Base</div>
        <div className="font-mono text-[8px] text-green-600 font-semibold uppercase">Released</div>
      </div>
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

interface Step {
  number: number;
  headline: string;
  description: string;
  mock: React.ReactNode;
}

function StepCard({ step }: { step: Step }) {
  return (
    <div className="flex flex-col gap-4 p-6 border-[2.5px] border-db-ink rounded-[20px] bg-db-bg shadow-[6px_6px_0_var(--db-ink)]">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[2.5px] border-db-ink bg-db-ink text-db-cream font-display font-bold text-sm">
          {step.number}
        </span>
        <h3 className="font-display font-bold text-lg tracking-[-0.01em] leading-tight">
          {step.headline}
        </h3>
      </div>
      <p className="font-body text-sm text-db-ink/70 leading-relaxed -mt-1">
        {step.description}
      </p>
      <div className="mt-1">{step.mock}</div>
    </div>
  );
}

// ─── Step data ────────────────────────────────────────────────────────────────

const SELL_STEPS: Step[] = [
  {
    number: 1,
    headline: "Claim your handle",
    description: "Pick a handle, connect your wallet, set your channels and prices. Done in under two minutes.",
    mock: <MockHandleClaim />,
  },
  {
    number: 2,
    headline: "Share your link",
    description: "Post linky.so/yourname anywhere — your bio, Twitter, LinkedIn, or a newsletter. One link, all access.",
    mock: <MockShareLink />,
  },
  {
    number: 3,
    headline: "Receive booking requests",
    description: "Buyers pay your USDC price up front to unlock your contact. The payment lands in your wallet instantly, and you reply on your own schedule.",
    mock: <MockBookingRequest />,
  },
  {
    number: 4,
    headline: "Get paid in USDC",
    description: "The USDC is already in your wallet, settled on Base the moment they paid. Just deliver. No invoices, no friction.",
    mock: <MockGetPaid />,
  },
];

const BUY_STEPS: Step[] = [
  {
    number: 1,
    headline: "Find an expert",
    description: "Browse LINKY profiles or click a link someone shared. Every profile shows exactly what you're getting and what it costs.",
    mock: <MockFindExpert />,
  },
  {
    number: 2,
    headline: "Pick a channel and pay USDC",
    description: "Choose how you want to reach them, message or call. Pay the USDC price and their contact unlocks instantly. One payment, direct access.",
    mock: <MockPickChannel />,
  },
  {
    number: 3,
    headline: "Expert answers",
    description: "The expert receives your funded request and responds through the channel you chose. Real knowledge, not an auto-reply.",
    mock: <MockExpertAnswers />,
  },
  {
    number: 4,
    headline: "Done — USDC released",
    description: "Once answered, USDC settles on Base and the booking closes. No platform middleman holding your funds.",
    mock: <MockDone />,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "sell" | "buy";

export default function HowItWorks() {
  const search = useSearch();
  const initialTab = new URLSearchParams(search).get("tab") === "buy" ? "buy" : "sell";
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const t = new URLSearchParams(search).get("tab");
    if (t === "buy" || t === "sell") setTab(t);
  }, [search]);

  const steps = tab === "sell" ? SELL_STEPS : BUY_STEPS;

  return (
    <>
      <Helmet>
        <title>How it works — LINKY</title>
        <meta
          name="description"
          content="Sell your expertise for USDC in minutes, or buy direct access to world-class knowledge. Here's how LINKY works."
        />
      </Helmet>

      <div className="container max-w-5xl mx-auto px-4 pt-14 pb-20">
        {/* Header */}
        <div className="mb-10">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-3">
            // How it works
          </div>
          <h1 className="font-display font-bold text-5xl md:text-6xl tracking-[-0.02em] leading-[1.02] mb-4">
            Simple on both sides.
          </h1>
          <p className="font-body text-lg text-db-ink/70 max-w-xl leading-snug">
            Whether you're monetising your knowledge or paying for access to it, LINKY gets out of the way.
          </p>
        </div>

        {/* Sell / Buy toggle */}
        <div className="flex mb-10">
          <div className="inline-flex items-center border-[2.5px] border-db-ink rounded-full bg-db-bg-alt p-1 shadow-[3px_3px_0_var(--db-ink)]">
            <button
              type="button"
              onClick={() => setTab("sell")}
              className={`font-mono text-[11px] font-semibold uppercase tracking-[0.08em] px-5 h-9 rounded-full transition-colors ${
                tab === "sell"
                  ? "bg-db-ink text-db-cream shadow-[1px_1px_0_var(--db-ink)]"
                  : "text-db-ink hover:text-db-cobalt"
              }`}
            >
              Sell
            </button>
            <button
              type="button"
              onClick={() => setTab("buy")}
              className={`font-mono text-[11px] font-semibold uppercase tracking-[0.08em] px-5 h-9 rounded-full transition-colors ${
                tab === "buy"
                  ? "bg-db-cobalt text-white shadow-[1px_1px_0_var(--db-cobalt)]"
                  : "text-db-ink hover:text-db-cobalt"
              }`}
            >
              Buy
            </button>
          </div>
        </div>

        {/* Step label */}
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-6">
          {tab === "sell"
            ? "// Monetise your expertise in 4 steps"
            : "// Get direct access in 4 steps"}
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {steps.map((step) => (
            <StepCard key={step.number} step={step} />
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 flex flex-col sm:flex-row items-start sm:items-center gap-5 border-t-[2.5px] border-db-ink pt-10">
          {tab === "sell" ? (
            <>
              <Link
                href="/new"
                className="inline-flex h-14 items-center justify-center gap-2 px-7 bg-db-cobalt border-[2.5px] border-db-ink rounded-[16px] font-display font-bold text-base text-white shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--db-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--db-ink)] transition-[transform,box-shadow]"
              >
                Claim your handle <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/"
                className="font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-db-ink/70 hover:text-db-cobalt underline-offset-4 hover:underline"
              >
                ← Back to home
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/experts"
                className="inline-flex h-14 items-center justify-center gap-2 px-7 bg-db-cobalt border-[2.5px] border-db-ink rounded-[16px] font-display font-bold text-base text-white shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--db-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--db-ink)] transition-[transform,box-shadow]"
              >
                Find an expert <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/"
                className="font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-db-ink/70 hover:text-db-cobalt underline-offset-4 hover:underline"
              >
                ← Back to home
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
