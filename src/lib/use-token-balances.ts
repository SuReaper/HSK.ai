"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { erc20Abi, getAddress, type Address } from "viem";
import { NETWORKS_BY_ID, isHashKeyChain, TOKENS } from "@/lib/wagmi/chains";

export interface DiscoveredToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  usdValue: string;
  logoUri?: string;
  chainId?: number;
}

interface BlockscoutTokenItem {
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: string;
    type?: string;
    exchange_rate?: string | null;
    icon_url?: string | null;
  };
  value: string | null;
}

function explorerApiBase(chainId: number): string | null {
  if (!isHashKeyChain(chainId)) return null;
  return NETWORKS_BY_ID[chainId]?.blockExplorers?.default.url ?? null;
}

const PATH_ENTRY_KEY = "token-balances";

// ────────────────────────────────────────────────────────────────────
// Token balances hook
//
// Fetches ERC-20 balances for known tokens (CCIP-BnM) across ALL
// configured chains — each chain has its own publicClient. Also
// fetches discovered tokens from Blockscout for the active HashKey
// chain.
// ────────────────────────────────────────────────────────────────────

export function useTokenBalances() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const baseClient = usePublicClient({ chainId: 133 });
  const sepoliaClient = usePublicClient({ chainId: 11155111 });
  const baseSepoliaClient = usePublicClient({ chainId: 84532 });
  const arbitrumSepoliaClient = usePublicClient({ chainId: 421614 });
  const opSepoliaClient = usePublicClient({ chainId: 11155420 });
  const polygonAmoyClient = usePublicClient({ chainId: 80002 });
  const avalancheFujiClient = usePublicClient({ chainId: 43113 });

  const chainClients: Record<number, typeof publicClient> = {
    133: baseClient,
    11155111: sepoliaClient,
    84532: baseSepoliaClient,
    421614: arbitrumSepoliaClient,
    11155420: opSepoliaClient,
    80002: polygonAmoyClient,
    43113: avalancheFujiClient,
  };

  const tokenChains = Object.keys(TOKENS).map(Number);
  const enabled = Boolean(isConnected && address);

  return useQuery<DiscoveredToken[]>({
    queryKey: [PATH_ENTRY_KEY, chainId, address],
    queryFn: async () => {
      if (!address) return [];
      const results: DiscoveredToken[] = [];

      // 1. Blockscout explorer fetch for HashKey chains (current wallet chain)
      if (chainId) {
        const apiBase = explorerApiBase(chainId);
        if (apiBase) {
          try {
            const res = await fetch(
              `${apiBase}/api/v2/addresses/${address}/token-balances`,
              { cache: "no-store" },
            );
            if (res.ok) {
              const body = (await res.json()) as BlockscoutTokenItem[] | { items?: BlockscoutTokenItem[] };
              const items = Array.isArray(body) ? body : body.items ?? [];
              for (const item of items) {
                if (!item?.token?.address || !item.token.symbol) continue;
                if (item.token.type === "ERC-721" || item.token.type === "ERC-1155") continue;
                if (BigInt(item.value ?? "0") === 0n) continue;
                const decimals = Number(item.token.decimals) || 18;
                let usdValue = "0";
                if (item.token.exchange_rate) {
                  const rate = Number(item.token.exchange_rate);
                  if (!Number.isNaN(rate)) {
                    const human = Number(item.value ?? "0") / 10 ** decimals;
                    usdValue = String(human * rate);
                  }
                }
                results.push({
                  address: item.token.address,
                  symbol: item.token.symbol,
                  name: item.token.name || item.token.symbol,
                  decimals,
                  balance: item.value ?? "0",
                  usdValue,
                  logoUri: item.token.icon_url ?? undefined,
                  chainId,
                });
              }
            }
          } catch {
            // Explorer fetch failed — non-critical
          }
        }
      }

      // 2. Direct ERC-20 balanceOf for known tokens on all configured chains
      for (const tokenChainId of tokenChains) {
        const tokenInfo = TOKENS[tokenChainId];
        if (!tokenInfo?.address) continue;
        const client = chainClients[tokenChainId] ?? publicClient;
        if (!client) continue;
        try {
          const balance = (await client.readContract({
            address: tokenInfo.address as Address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [getAddress(address)],
          })) as bigint;
          if (balance === 0n) continue;
          results.push({
            address: tokenInfo.address,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            decimals: tokenInfo.decimals,
            balance: balance.toString(),
            usdValue: "0",
            chainId: tokenChainId,
          });
        } catch {
          // RPC failed for this chain — skip
        }
      }

      return results.sort((a, b) => {
        const aUsd = Number(a.usdValue || "0");
        const bUsd = Number(b.usdValue || "0");
        if (aUsd !== bUsd) return bUsd - aUsd;
        return a.symbol.localeCompare(b.symbol);
      });
    },
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
