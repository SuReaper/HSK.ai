import { resolveChain, chainDomain, type ChainConfig, type ChainName } from "@hsp/core/chains/index";
import type { DomainInput } from "@hsp/core";
import { getAddress, type Address } from "viem";

export interface HspConfig {
  chain: ChainConfig;
  domain: DomainInput;
  adapterAddress: Address;
  coordinatorUrl: string;
  facilitatorUrl: string | undefined;
  apiKey: string;
}

const CHAIN_ID_TO_NAME: Record<number, ChainName> = {
  133: "hashkey-testnet",
  177: "hashkey",
  1: "ethereum",
  31337: "anvil-dev",
};

let cached: HspConfig | null = null;
const cacheByChain = new Map<number, HspConfig>();

function buildConfig(chainName: ChainName): HspConfig {
  const coordinatorUrl = process.env.HSP_COORDINATOR_URL;
  if (!coordinatorUrl) {
    throw new Error("HSP_COORDINATOR_URL is not set");
  }

  const facilitatorUrl = process.env.HSP_FACILITATOR_URL;
  const apiKey = process.env.HSP_API_KEY ?? "";
  const adapterAddressRaw = process.env.HSP_PINNED_ADAPTER_ADDRESS;
  if (!adapterAddressRaw) {
    throw new Error("HSP_PINNED_ADAPTER_ADDRESS is not set");
  }

  const chain = resolveChain(chainName);
  const domain = chainDomain(chain);
  const adapterAddress = getAddress(adapterAddressRaw);

  return { chain, domain, adapterAddress, coordinatorUrl, facilitatorUrl, apiKey };
}

/**
 * Get HSP config. If `chainId` is provided, resolves the chain dynamically
 * (for when the wallet is on a different chain than the default HSP_CHAIN).
 * Otherwise falls back to the server-side HSP_CHAIN env var.
 */
export function getHspConfig(chainId?: number): HspConfig {
  if (chainId !== undefined) {
    const existing = cacheByChain.get(chainId);
    if (existing) return existing;
    const chainName = CHAIN_ID_TO_NAME[chainId];
    if (!chainName) {
      throw new Error(`Unsupported chain ID ${chainId} for HSP`);
    }
    const config = buildConfig(chainName);
    cacheByChain.set(chainId, config);
    return config;
  }

  if (cached) return cached;
  const chainName = (process.env.HSP_CHAIN ?? "hashkey-testnet") as ChainName;
  cached = buildConfig(chainName);
  return cached;
}
