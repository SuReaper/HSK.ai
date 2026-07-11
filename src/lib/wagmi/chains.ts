import { defineChain } from "viem";
import {
  mainnet,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  polygonAmoy,
  avalancheFuji,
} from "viem/chains";
import type { AppKitNetwork } from "@reown/appkit/networks";

export const hashkeyTestnet = defineChain({
  id: 133,
  name: "HashKey Chain Testnet",
  nativeCurrency: { name: "HashKey Token", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.hsk.xyz"] },
  },
  blockExplorers: {
    default: { name: "HashKey Testnet Explorer", url: "https://testnet-explorer.hsk.xyz" },
  },
  testnet: true,
});

export const hashkeyMainnet = defineChain({
  id: 177,
  name: "HashKey Chain",
  nativeCurrency: { name: "HashKey Token", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.hsk.xyz"] },
  },
  blockExplorers: {
    default: { name: "HashKey Explorer", url: "https://hashkey.blockscout.com" },
  },
});

export const BASE_NETWORKS: [AppKitNetwork, ...AppKitNetwork[]] = [
  hashkeyTestnet,
  hashkeyMainnet,
  mainnet as unknown as AppKitNetwork,
  sepolia as unknown as AppKitNetwork,
  baseSepolia as unknown as AppKitNetwork,
  arbitrumSepolia as unknown as AppKitNetwork,
  optimismSepolia as unknown as AppKitNetwork,
  polygonAmoy as unknown as AppKitNetwork,
  avalancheFuji as unknown as AppKitNetwork,
];

const BASE_NETWORKS_BY_ID: Record<number, AppKitNetwork> = {
  133: hashkeyTestnet,
  177: hashkeyMainnet,
  1: mainnet as unknown as AppKitNetwork,
  11155111: sepolia as unknown as AppKitNetwork,
  84532: baseSepolia as unknown as AppKitNetwork,
  421614: arbitrumSepolia as unknown as AppKitNetwork,
  11155420: optimismSepolia as unknown as AppKitNetwork,
  80002: polygonAmoy as unknown as AppKitNetwork,
  43113: avalancheFuji as unknown as AppKitNetwork,
};

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  ...BASE_NETWORKS,
];

export const NETWORKS_BY_ID: Record<number, AppKitNetwork> = {
  ...BASE_NETWORKS_BY_ID,
};

export function networkName(chainId?: number): string {
  if (!chainId) return "Not connected";
  return NETWORKS_BY_ID[chainId]?.name ?? `Chain ${chainId}`;
}

export interface TokenInfo {
  address: `0x${string}` | null;
  decimals: number;
  symbol: string;
  name: string;
}

export const CCIP_BNM_SYMBOL = "CCIP-BnM";

export const TOKENS: Record<number, TokenInfo> = {
  11155111: {
    address: "0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05",
    decimals: 18,
    symbol: CCIP_BNM_SYMBOL,
    name: "CCIP-BnM (Sepolia)",
  },
  84532: {
    address: "0x88A2d74F47a237a62e7A51cdDa67270CE381555e",
    decimals: 18,
    symbol: CCIP_BNM_SYMBOL,
    name: "CCIP-BnM (Base Sepolia)",
  },
  421614: {
    address: "0xA8C0c11bf64AF62CDCA6f93D3769B88BdD7cb93D",
    decimals: 18,
    symbol: CCIP_BNM_SYMBOL,
    name: "CCIP-BnM (Arbitrum Sepolia)",
  },
  11155420: {
    address: "0x8aF4204e30565DF93352fE8E1De78925F6664dA7",
    decimals: 18,
    symbol: CCIP_BNM_SYMBOL,
    name: "CCIP-BnM (OP Sepolia)",
  },
  80002: {
    address: "0xcab0EF91Bee323d1A617c0a027eE753aFd6997E4",
    decimals: 18,
    symbol: CCIP_BNM_SYMBOL,
    name: "CCIP-BnM (Polygon Amoy)",
  },
  43113: {
    address: "0xD21341536c5cF5EB1bcb58f6723cE26e8D8E90e4",
    decimals: 18,
    symbol: CCIP_BNM_SYMBOL,
    name: "CCIP-BnM (Avalanche Fuji)",
  },
  133: {
    address: "0xB0F91Ce2ECAa3555D4b1fD4489bD9a207a7844f0",
    decimals: 18,
    symbol: CCIP_BNM_SYMBOL,
    name: "CCIP-BnM (HashKey Testnet)",
  },
};

export function getUsdc(chainId?: number): TokenInfo | null {
  if (!chainId) return null;
  return TOKENS[chainId] ?? null;
}

export function explorerTxUrl(chainId: number, txHash: string): string {
  const base = NETWORKS_BY_ID[chainId]?.blockExplorers?.default.url;
  if (!base) return "#";
  return `${base}/tx/${txHash}`;
}

export function explorerAddressUrl(chainId: number, address: string): string {
  const base = NETWORKS_BY_ID[chainId]?.blockExplorers?.default.url;
  if (!base) return "#";
  return `${base}/address/${address}`;
}

export function rpcUrl(chainId?: number): string {
  const net = chainId ? NETWORKS_BY_ID[chainId] : undefined;
  return net?.rpcUrls.default.http[0] ?? hashkeyTestnet.rpcUrls.default.http[0];
}

export function isHashKeyChain(chainId?: number): boolean {
  return chainId === 133 || chainId === 177;
}
