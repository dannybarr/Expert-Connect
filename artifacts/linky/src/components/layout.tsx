import { Wallet, ConnectWallet, ConnectWalletText, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Avatar, Name, Identity, Address } from "@coinbase/onchainkit/identity";
import { Link, useLocation } from "wouter";
import { Wallet2 } from "lucide-react";

function ViewToggle() {
  const [location, setLocation] = useLocation();

  // Sell-side surfaces: signup and the seller dashboard.
  const isSellView = location === "/new" || location === "/dashboard";
  // Buy-side surfaces: the experts directory and any expert profile page.
  // Anything that isn't a sell surface counts as a buy view so the toggle
  // stays highlighted while browsing experts.
  const isBuyView = !isSellView;

  const goBuy = () => {
    // The buy experience is the experts directory — browse rows, open any
    // expert's full profile in a popup and pay there.
    setLocation("/experts");
  };

  return (
    <div
      className="inline-flex items-center border-[2.5px] border-db-ink rounded-full bg-db-bg-alt p-0.5 shadow-[2px_2px_0_var(--db-ink)]"
      title="Switch between seller signup and a sample buyer experience"
    >
      <button
        type="button"
        onClick={() => setLocation("/new")}
        className={`font-mono text-[10px] font-semibold uppercase tracking-[0.08em] px-3 h-7 rounded-full transition-colors ${
          isSellView ? "bg-db-ink text-db-cream" : "text-db-ink hover:text-db-cobalt"
        }`}
        data-testid="nav-sell"
      >
        Sell
      </button>
      <button
        type="button"
        onClick={goBuy}
        className={`font-mono text-[10px] font-semibold uppercase tracking-[0.08em] px-3 h-7 rounded-full transition-colors ${
          isBuyView ? "bg-db-cobalt text-white" : "text-db-ink hover:text-db-cobalt"
        }`}
        title="Browse the expert directory"
        data-testid="nav-buy"
      >
        Buy
      </button>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-db-bg text-db-ink">
      <header className="sticky top-0 z-50 w-full border-b-[2.5px] border-db-ink bg-db-bg">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
          <Link href="/" className="db-sticker-linky">
            <span aria-hidden>★</span> LINKY
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ViewToggle />
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-ink hover:text-db-cobalt"
            >
              Dashboard
            </Link>
            <Wallet>
              <ConnectWallet className="border-[2.5px] border-db-ink bg-db-cobalt text-white rounded-[10px] px-2.5 sm:px-4 h-8 sm:h-10 font-display font-bold text-xs sm:text-sm shadow-[3px_3px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px transition-transform">
                <ConnectWalletText>
                  <Wallet2 className="h-4 w-4 sm:hidden" />
                  <span className="hidden sm:inline">Connect Wallet</span>
                </ConnectWalletText>
                <Avatar className="h-4 w-4 sm:h-5 sm:w-5" />
                <Name className="hidden sm:block" />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address />
                </Identity>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
      <footer className="border-t-[2.5px] border-db-ink py-8 text-center">
        <p className="font-mono uppercase tracking-[0.08em] text-xs text-db-mute">
          LINKY — Human intelligence, on-chain. Settled on Base.
        </p>
      </footer>
    </div>
  );
}
