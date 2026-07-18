import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import { loadSession } from "./lib/session";
import "@coinbase/onchainkit/styles.css";
import "./index.css";

setAuthTokenGetter(() => loadSession()?.token ?? null);

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
