import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { useGetConfig } from "@workspace/api-client-react";

import Home from "@/pages/home";
import NewExpert from "@/pages/new-expert";
import ExpertProfile from "@/pages/expert-profile";
import Booking from "@/pages/booking";
import Dashboard from "@/pages/dashboard";
import DocsAgents from "@/pages/docs-agents";
import HowItWorks from "@/pages/how-it-works";
import Experts from "@/pages/experts";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";

const queryClient = new QueryClient();

const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

const connectors = [
  coinbaseWallet({ appName: "LINKY", preference: "smartWalletOnly" }),
  injected(),
  ...(wcProjectId ? [walletConnect({ projectId: wcProjectId })] : []),
];

const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors,
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/new" component={NewExpert} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/docs/agents" component={DocsAgents} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/experts" component={Experts} />
        <Route path="/booking/:id" component={Booking} />
        <Route path="/:handle" component={ExpertProfile} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AppContent() {
  const { data: config } = useGetConfig();
  const chain = config?.chainId === 8453 ? base : baseSepolia;
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
  const logoUrl = `${window.location.origin}${import.meta.env.BASE_URL}favicon.svg`;

  const inner = (
    <MiniKitProvider
      apiKey={import.meta.env.VITE_ONCHAINKIT_API_KEY}
      chain={chain}
      config={{
        appearance: {
          name: "LINKY",
          logo: logoUrl,
          mode: "auto",
          theme: "default",
        },
      }}
    >
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </MiniKitProvider>
  );

  return baseUrl ? <WouterRouter base={baseUrl}>{inner}</WouterRouter> : inner;
}

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
