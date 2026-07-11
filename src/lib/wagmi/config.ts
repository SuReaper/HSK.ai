import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { networks, NETWORKS_BY_ID } from "@/lib/wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "";

if (!projectId) {
  console.warn("[HSK.ai] NEXT_PUBLIC_WC_PROJECT_ID is not set. WalletConnect will not work.");
}

const metadata = {
  name: "HSK.ai",
  description: "Intent-to-Pay assistant for HashKey Chain",
  url: typeof window !== "undefined" ? window.location.origin : "https://hsk.ai",
  icons: ["/hskailogo.png"],
};

const EVM_CHAIN_IDS = networks.map((n) => Number(n.id));
const eip155Chains = EVM_CHAIN_IDS.map((id) => `eip155:${id}`);
const eip155RpcMap: Record<string, string> = {};
for (const id of EVM_CHAIN_IDS) {
  const net = NETWORKS_BY_ID[id];
  if (net?.rpcUrls?.default?.http?.[0]) {
    eip155RpcMap[String(id)] = net.rpcUrls.default.http[0];
  }
}

const universalProviderConfigOverride = {
  chains: { eip155: eip155Chains },
  rpcMap: eip155RpcMap,
  defaultChain: `eip155:${networks[0].id}`,
};

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
});

const G = globalThis as unknown as { __hspAppKitInit?: boolean };

function appkitOptions() {
  return {
    adapters: [wagmiAdapter],
    networks,
    defaultNetwork: networks[0],
    projectId,
    metadata,
    allowUnsupportedChain: true,
    universalProviderConfigOverride,
    features: {
      analytics: false,
      email: false,
      socials: [] as never[],
    },
    themeMode: "dark" as const,
    themeVariables: {
      "--w3m-accent": "#9d63f2",
      "--w3m-border-radius-master": "1rem",
    },
  };
}

export function ensureAppKitInitialized(): void {
  if (typeof window === "undefined") return;
  if (G.__hspAppKitInit) return;
  G.__hspAppKitInit = true;
  createAppKit(appkitOptions());
}

const suppressPatterns = new Set([
  "walletconnect",
  "wc://",
  "Relay",
  "UNIVERSAL_PROVIDER",
  "Connection interrupted",
  "Analytics SDK",
  "AnalyticsSDKApiError",
  "MaxListeners",
  "Possible EventEmitter memory leak",
  "Lit is in dev mode",
]);

function shouldSuppress(msg: string): boolean {
  for (const p of suppressPatterns) {
    if (msg.includes(p)) return true;
  }
  return false;
}

if (typeof window !== "undefined") {
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
    if (shouldSuppress(msg)) return;
    if (!msg || msg === "undefined" || msg === "[object Object]" || msg === "{}") return;
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
    if (shouldSuppress(msg)) return;
    if (!msg || msg === "undefined" || msg === "[object Object]" || msg === "{}") return;
    origWarn(...args);
  };
}

export const wagmiConfig = wagmiAdapter.wagmiConfig;
export const appkitProjectId = projectId;
export { wagmiAdapter };
