import { Helmet } from "react-helmet-async";

const askExample = `import { createWalletClient, http, parseUnits, custom } from "viem";
import { base } from "viem/chains";

const API = "https://linky.so/api"; // or wherever LINKY is hosted

// 1) Discover experts
const registry = await fetch(\`\${API}/v1/experts\`).then((r) => r.json());
const expert = registry.experts.find((e) => e.handle === "alex");
const channel = expert.channels.find((c) => c.id === "messaging");

// 2) Sign + create the ask. The signed message binds every mutable field of
//    the ask so a captured signature can't be replayed against a different
//    question, channel, or callback target.
const timestamp = Math.floor(Date.now() / 1000);
const question = "What's the best DEX router for a $50k swap on Base?";
const callbackUrl = "https://my-agent.example.com/linky-hook";
const askHash = crypto
  .createHash("sha256")
  .update(\`\${question}\\n\${callbackUrl}\`)
  .digest("hex");
const message = \`LINKY:\${registry.chain.id}:agent-ask:\${expert.handle}:\${channel.id}:\${askHash}:\${timestamp}\`;
const signature = await walletClient.signMessage({ account, message });

const ask = await fetch(\`\${API}/v1/ask\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    expertHandle: expert.handle,
    channelId: channel.id,
    question,
    callbackUrl,
    wallet: account.address,
    signature,
    timestamp,
  }),
}).then((r) => r.json());

// 3) Fund the escrow on-chain
//    - approve USDC for the escrow contract
//    - call escrow.book(id, expert, amount)
const amount = BigInt(ask.funding.amount);
await walletClient.writeContract({
  address: ask.funding.tokenContract,
  abi: erc20Abi,
  functionName: "approve",
  args: [ask.funding.escrowContract, amount],
});
const txHash = await walletClient.writeContract({
  address: ask.funding.escrowContract,
  abi: escrowAbi,
  functionName: "book",
  args: [ask.escrowId, ask.funding.expertWallet, amount],
});

// 4) Poll status (or just wait for the webhook)
const status = await fetch(
  \`\${API}/v1/ask/\${ask.escrowId}?txHash=\${txHash}\`,
).then((r) => r.json());
// status.state -> awaiting_funding | funded | answered | released | refunded | expired
// status.answer -> { text, links[] } once the expert has answered`;

const webhookExample = `import crypto from "node:crypto";

app.post("/linky-hook", (req, res) => {
  const sig = req.headers["linky-signature"]; // "t=<unix>,v1=<hex>"
  const [tPart, v1Part] = sig.split(",");
  const t = tPart.slice(2);
  const v1 = v1Part.slice(3);

  const raw = JSON.stringify(req.body); // capture the RAW body, not re-encoded
  const expected = crypto
    .createHmac("sha256", process.env.LINKY_WEBHOOK_SECRET) // returned by POST /v1/ask
    .update(\`\${t}.\${raw}\`)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"))) {
    return res.status(401).end();
  }
  // req.body.event in: funded | answered | released | refunded | expired
  // req.body.answer in: { text, links[] } once present
  console.log("LINKY event", req.body.event, req.body.escrowId);
  res.status(200).end();
});`;

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto p-4 bg-db-ink text-db-cream border-[2.5px] border-db-ink rounded-[12px] shadow-[5px_5px_0_var(--db-ink)] text-[12px] font-mono leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  summary,
  children,
}: {
  method: "GET" | "POST";
  path: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-2 flex-wrap">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] bg-db-honey text-db-ink border-[2.5px] border-db-ink px-2 py-0.5 rounded-full">
          {method}
        </span>
        <span className="font-mono text-base font-semibold">{path}</span>
      </div>
      <p className="text-db-mute mb-3">{summary}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function DocsAgents() {
  return (
    <div className="container max-w-3xl mx-auto px-4 py-12">
      <Helmet>
        <title>Agent API — LINKY</title>
        <meta
          name="description"
          content="LINKY Agent API: let AI agents buy expert answers in USDC on Base."
        />
      </Helmet>

      <div className="mb-10">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-2">
          // /docs/agents
        </div>
        <h1 className="font-display text-5xl font-bold tracking-[-0.02em] mb-4">
          Agents can buy answers.
        </h1>
        <p className="text-db-mute text-lg">
          Four endpoints, one webhook, one signature, one escrow. Same contract the
          humans use. No SDK, no API key, no setup call.
        </p>
      </div>

      <section className="mb-8 p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-cream shadow-[5px_5px_0_var(--db-ink)]">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-3">
          // Found a LINKY link on X or LinkedIn?
        </div>
        <p className="text-sm mb-3">
          Every public profile URL (<code className="font-mono">linky.so/&lt;handle&gt;</code>)
          carries machine-readable hints so an agent crawling the link can check
          out without ever rendering the page:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            <code className="font-mono">&lt;link rel="alternate" type="application/json"
            href="/api/v1/experts/&lt;handle&gt;"&gt;</code>{" "}
            — fetch this URL to get the expert record, channels, prices, and the
            chain/escrow config in one call.
          </li>
          <li>
            <code className="font-mono">&lt;meta name="linky:agent-api" content="/api/v1/ask"&gt;</code>{" "}
            and <code className="font-mono">linky:agent-docs</code> point at the
            ask endpoint and this page.
          </li>
          <li>
            JSON-LD <code className="font-mono">Person</code> with a{" "}
            <code className="font-mono">BuyAction</code> potentialAction whose
            target is the same ask endpoint, with the USDC price.
          </li>
        </ul>
        <p className="text-sm mt-3 text-db-mute">
          So the agent flow from a link in the wild is:{" "}
          <code className="font-mono">GET linky.so/alex</code> →{" "}
          <code className="font-mono">GET /api/v1/experts/alex</code> →{" "}
          <code className="font-mono">POST /api/v1/ask</code> → fund escrow →
          webhook.
        </p>
      </section>

      <section className="mb-10 p-6 border-[2.5px] border-db-ink rounded-[16px] bg-db-bg-alt shadow-[5px_5px_0_var(--db-ink)]">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-db-mute mb-3">
          // The shape
        </div>
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          <li>
            <code className="font-mono">GET /api/v1/experts</code> — discover sellers,
            their channels, prices, and the escrow contract address.
          </li>
          <li>
            <code className="font-mono">POST /api/v1/ask</code> — sign and submit the
            request. You get back an <code className="font-mono">escrowId</code>, the
            exact USDC amount, and where to send it.
          </li>
          <li>
            Fund the escrow on-chain by calling{" "}
            <code className="font-mono">escrow.book(id, expert, amount)</code> after
            approving USDC. Same contract the LINKY web app uses.
          </li>
          <li>
            <code className="font-mono">GET /api/v1/ask/:escrowId</code> — poll for
            state, or just wait for the webhook to land on your{" "}
            <code className="font-mono">callbackUrl</code>.
          </li>
        </ol>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-2xl font-bold tracking-[-0.02em] mb-3">
          Auth
        </h2>
        <p className="text-db-mute mb-3">
          <code className="font-mono">POST /v1/ask</code> requires a wallet signature
          over a deterministic message. No API key, no session token. The signed
          message is:
        </p>
        <Code>{`LINKY:<chainId>:agent-ask:<expertHandle>:<channelId>:<sha256(question + "\\n" + (callbackUrl||""))>:<timestamp>`}</Code>
        <p className="text-db-mute mt-3 text-sm">
          Timestamps are seconds since epoch and must be within 5 minutes of the
          server clock. Public endpoints are IP rate-limited (60 req/min).
        </p>
      </section>

      <Endpoint
        method="GET"
        path="/api/v1/experts"
        summary="The agent-readable registry. No auth. Cacheable. Includes the live escrow contract address and chain id so your agent can pay without any side-channel."
      >
        <Code>{`{
  "chain": {
    "id": 8453,
    "name": "Base",
    "escrowContract": "0x...",
    "tokenContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "tokenSymbol": "USDC",
    "tokenDecimals": 6,
    "platformFeeBps": 500,
    "refundDelaySeconds": 604800
  },
  "experts": [
    {
      "handle": "alex",
      "wallet": "0x...",
      "name": "Alex",
      "about": "Solidity auditor",
      "channels": [
        { "id": "messaging", "platform": "telegram", "priceUsdc": "20.000000" },
        { "id": "calls",                              "priceUsdc": "200.000000" }
      ]
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "count": 1 }
}`}</Code>
      </Endpoint>

      <Endpoint
        method="POST"
        path="/api/v1/ask"
        summary="Create a draft booking. Returns the escrowId, the exact funding parameters, and (if you supplied callbackUrl) a per-booking webhook secret."
      >
        <Code>{`// Request
{
  "expertHandle":  "alex",
  "channelId":     "messaging",
  "question":      "What's the best DEX router for a $50k swap on Base?",
  "callbackUrl":   "https://my-agent.example.com/linky-hook",
  "wallet":        "0x...",
  "signature":     "0x...",
  "timestamp":     1716300000
}`}</Code>
        <Code>{`// 201 Created
{
  "escrowId":   "0x...",       // bytes32 — pass to escrow.book(id, expert, amount)
  "state":      "awaiting_funding",
  "funding": {
    "chainId":         8453,
    "escrowContract":  "0x...",
    "tokenContract":   "0x...",
    "expertWallet":    "0x...",
    "amount":          "20000000",
    "amountUsdc":      "20.000000",
    "tokenDecimals":   6,
    "deadline":        1716386400,
    "method":          "escrow.book(bytes32 id, address expert, uint256 amount)"
  },
  "webhook": {
    "url":              "https://my-agent.example.com/linky-hook",
    "secret":           "<hex>",
    "signatureHeader":  "LINKY-Signature",
    "signatureScheme":  "t=<unix>,v1=<hex-hmac-sha256(secret, \`\${t}.\${rawBody}\`)>"
  }
}`}</Code>
      </Endpoint>

      <Endpoint
        method="GET"
        path="/api/v1/ask/:escrowId"
        summary="Read the current state. Pass ?txHash=0x... right after funding to have the server verify the on-chain Booked event and promote the booking from awaiting_funding to funded immediately (the webhook will fire too)."
      >
        <Code>{`// 200 OK
{
  "escrowId":      "0x...",
  "state":         "answered",       // awaiting_funding | funded | answered | released | refunded | expired
  "expertHandle":  "alex",
  "channelId":     "messaging",
  "amountUsdc":    "20.000000",
  "question":      "What's the best DEX router for a $50k swap on Base?",
  "answer": {
    "text":   "Use Uniswap v4 universal router — splits via v3 + v2 pools.",
    "links":  ["https://docs.uniswap.org/contracts/v4/overview"]
  },
  "txHashes": { "book": "0x...", "release": "0x...", "refund": null },
  "createdAt": "2026-05-21T10:00:00.000Z",
  "deadline":  "2026-05-22T10:00:00.000Z"
}`}</Code>
      </Endpoint>

      <section className="mb-12">
        <h2 className="font-display text-2xl font-bold tracking-[-0.02em] mb-3">
          Webhook signature
        </h2>
        <p className="text-db-mute mb-3">
          Every callback is HMAC-signed with the per-booking secret returned by{" "}
          <code className="font-mono">POST /v1/ask</code>. Verify the raw body before
          trusting it. We retry non-2xx responses with exponential backoff for up to
          ~24 hours.
        </p>
        <Code>{webhookExample}</Code>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-2xl font-bold tracking-[-0.02em] mb-3">
          End-to-end example
        </h2>
        <p className="text-db-mute mb-3">
          A complete buy-an-answer flow with{" "}
          <code className="font-mono">viem</code> and <code className="font-mono">fetch</code>.
        </p>
        <Code>{askExample}</Code>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-2xl font-bold tracking-[-0.02em] mb-3">
          Errors
        </h2>
        <p className="text-db-mute mb-3 text-sm">
          All errors return JSON shaped like{" "}
          <code className="font-mono">{`{ "error": "...", "code": "..." }`}</code>{" "}
          with a stable <code className="font-mono">code</code> field. Common codes:
        </p>
        <ul className="text-sm font-mono space-y-1 text-db-mute">
          <li>
            <span className="text-db-ink">bad_signature</span> — wallet signature
            invalid or expired
          </li>
          <li>
            <span className="text-db-ink">expert_not_found</span>
          </li>
          <li>
            <span className="text-db-ink">channel_disabled</span> — expert has not
            enabled that channel
          </li>
          <li>
            <span className="text-db-ink">escrow_unavailable</span> — operator hasn't
            set <code>LINKY_ESCROW_ADDRESS</code> yet
          </li>
          <li>
            <span className="text-db-ink">rate_limited</span> — 60 req/min per IP
          </li>
        </ul>
      </section>
    </div>
  );
}
