import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center bg-db-bg px-4">
      <div className="w-full max-w-md p-8 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg shadow-[5px_5px_0_var(--db-ink)]">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-3">
          // Error 404
        </div>
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em] mb-3">
          Nothing here.<br/>That's a you problem.
        </h1>
        <p className="text-db-mute mb-6">
          The link you tapped doesn't exist. Check the handle, or go home and try again.
        </p>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center px-6 bg-db-cobalt text-db-cream border-[2.5px] border-db-ink rounded-[16px] font-display font-bold shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--db-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--db-ink)] transition-[transform,box-shadow]"
        >
          Take me home
        </Link>
      </div>
    </div>
  );
}
