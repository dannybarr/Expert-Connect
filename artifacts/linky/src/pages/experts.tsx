import { Helmet } from "react-helmet-async";
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useListExperts } from "@workspace/api-client-react";
import { ArrowRight, Search } from "lucide-react";
import { fmtUsdc } from "@/lib/fmt";
import { ExpertProfileContent } from "@/components/expert-profile-content";

// ─── Types & fallback ─────────────────────────────────────────────────────────

type ExpertLike = {
  handle: string;
  name: string;
  about: string;
  linkedinUrl?: string | null;
  xUrl?: string | null;
  avatarUrl?: string | null;
  messaging?: { platform: string; priceUsdc: string } | null;
  calls?: { priceUsdc: string } | null;
};

const AVATAR_COLORS = [
  { bg: "bg-db-honey", text: "text-db-ink" },
  { bg: "bg-db-cobalt", text: "text-white" },
  { bg: "bg-db-coral", text: "text-db-ink" },
  { bg: "bg-db-forest", text: "text-white" },
];

// ─── Row ──────────────────────────────────────────────────────────────────────

function ExpertAvatar({
  expert,
  index,
  size = "sm",
}: {
  expert: ExpertLike;
  index: number;
  size?: "sm" | "lg";
}) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const dim =
    size === "lg"
      ? "h-14 w-14 text-xl border-[2.5px]"
      : "h-9 w-9 text-sm border-[2px]";
  if (expert.avatarUrl) {
    return (
      <img
        src={expert.avatarUrl}
        alt={expert.name}
        className={`${dim} rounded-full border-db-ink object-cover shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full border-db-ink flex items-center justify-center shrink-0 font-display font-bold ${color.bg} ${color.text}`}
    >
      {expert.name.charAt(0)}
    </div>
  );
}

function ExpertRow({
  expert,
  index,
  isLast,
  onClick,
}: {
  expert: ExpertLike;
  index: number;
  isLast: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-db-bg-alt transition-colors ${!isLast ? "border-b-[1.5px] border-db-ink" : ""}`}
      data-testid={`expert-row-${expert.handle}`}
    >
      <ExpertAvatar expert={expert} index={index} size="sm" />

      {/* Name + handle */}
      <div className="w-40 shrink-0 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-bold text-sm leading-tight truncate">
            {expert.name}
          </span>
        </div>
        <div className="font-mono text-[9px] text-db-mute truncate">
          /{expert.handle}
        </div>
      </div>

      {/* About */}
      <p className="flex-1 font-body text-xs text-db-ink/60 truncate hidden sm:block">
        {expert.about}
      </p>

      {/* Channel pills */}
      <div className="hidden md:flex items-center gap-1.5 shrink-0">
        {expert.messaging && (
          <span className="font-mono text-[8px] uppercase tracking-wide border-[1.5px] border-db-ink rounded-full px-2 py-0.5 bg-db-honey text-db-ink whitespace-nowrap">
            {expert.messaging.platform === "telegram" ? "TG" : "WA"} · $
            {fmtUsdc(expert.messaging.priceUsdc)}
          </span>
        )}
        {expert.calls && (
          <span className="font-mono text-[8px] uppercase tracking-wide border-[1.5px] border-db-ink rounded-full px-2 py-0.5 bg-db-bg-alt text-db-ink whitespace-nowrap">
            Call · ${fmtUsdc(expert.calls.priceUsdc)}
          </span>
        )}
      </div>

      {/* Expand chevron */}
      <ArrowRight className="h-3.5 w-3.5 text-db-mute group-hover:text-db-cobalt group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
    </button>
  );
}

// ─── Full-profile modal ─────────────────────────────────────────────────────────

function ProfileModal({
  expert,
  onClose,
}: {
  expert: ExpertLike;
  onClose: () => void;
}) {
  // Close on Escape + lock background scroll while open.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${expert.name} — profile`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-db-ink/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto bg-db-bg border-[2.5px] border-db-ink rounded-t-[20px] sm:rounded-[20px] shadow-[8px_8px_0_var(--db-ink)]">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="sticky top-3.5 float-right mr-3.5 z-10 h-8 w-8 flex items-center justify-center rounded-full border-[2px] border-db-ink bg-db-bg-alt font-mono text-sm font-bold text-db-ink hover:bg-db-ink hover:text-db-cream transition-colors"
          aria-label="Close"
          data-testid="modal-close"
        >
          ×
        </button>

        <ExpertProfileContent handle={expert.handle} inModal />
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function Experts() {
  const { data: experts, isLoading } = useListExperts();
  const [selected, setSelected] = useState<{
    expert: ExpertLike;
    index: number;
  } | null>(null);
  const [query, setQuery] = useState("");

  const source: ExpertLike[] = (experts as ExpertLike[] | undefined) ?? [];
  const hasExperts = source.length > 0;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.handle.toLowerCase().includes(q) ||
        e.about.toLowerCase().includes(q),
    );
  }, [source, query]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 md:py-16">
      <Helmet>
        <title>Experts on LINKY</title>
        <meta
          name="description"
          content="Browse experts on LINKY. Pay in USDC to message or book a call — funds held in escrow until they answer."
        />
      </Helmet>

      {/* Header */}
      <div className="mb-6">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-2">
          // Browse
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-display font-bold text-4xl md:text-5xl tracking-[-0.02em] leading-[1.05]">
            Experts
          </h1>
          <Link
            href="/new"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-cobalt hover:underline underline-offset-4"
          >
            List yourself →
          </Link>
        </div>
        <p className="font-body text-sm text-db-ink/60 mt-2">
          {hasExperts
            ? `${source.length} expert${source.length === 1 ? "" : "s"} you can pay to reach. Tap any row to open their full profile.`
            : "No experts listed yet."}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-db-mute pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search experts…"
          className="w-full h-11 pl-10 pr-4 border-[2.5px] border-db-ink rounded-[12px] bg-db-bg font-body text-sm shadow-[3px_3px_0_var(--db-ink)] focus:outline-none focus:-translate-x-px focus:-translate-y-px focus:shadow-[4px_4px_0_var(--db-ink)] transition-all placeholder:text-db-mute"
          data-testid="expert-search"
        />
      </div>

      {/* Row list */}
      <div className="border-[2.5px] border-db-ink rounded-[16px] overflow-hidden shadow-[4px_4px_0_var(--db-ink)] bg-db-bg">
        {isLoading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-16 bg-db-bg-alt animate-pulse ${i < 2 ? "border-b-[1.5px] border-db-ink" : ""}`}
              />
            ))}
          </>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-db-mute">
            {query.trim() ? `No experts match “${query}”.` : "No experts listed yet."}
          </div>
        ) : (
          rows.map((expert, i) => (
            <ExpertRow
              key={expert.handle}
              expert={expert}
              index={i}
              isLast={i === rows.length - 1}
              onClick={() => setSelected({ expert, index: i })}
            />
          ))
        )}
      </div>

      {/* Full-profile modal */}
      {selected && (
        <ProfileModal
          expert={selected.expert}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
