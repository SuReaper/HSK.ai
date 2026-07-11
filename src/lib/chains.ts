import { type Address, getAddress } from "viem";

export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  stablecoin: {
    address: Address;
    symbol: string;
    decimals: number;
  };
  blockscoutUrl?: string;
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  "hashkey-testnet": {
    name: "hashkey-testnet",
    chainId: 133,
    rpcUrl: "https://testnet.hsk.xyz",
    stablecoin: {
      address: getAddress("0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6"),
      symbol: "USDC",
      decimals: 6,
    },
    blockscoutUrl: "https://testnet-explorer.hsk.xyz",
  },
  hashkey: {
    name: "hashkey",
    chainId: 177,
    rpcUrl: "https://mainnet.hsk.xyz",
    stablecoin: {
      address: getAddress("0x054ed45810DbBAb8B27668922D110669c9D88D0a"),
      symbol: "USDC.e",
      decimals: 6,
    },
    blockscoutUrl: "https://hashkey.blockscout.com",
  },
} as const;

export function getChainConfig(name: string | undefined): ChainConfig {
  const chainName = name ?? "hashkey-testnet";
  const cfg = CHAIN_CONFIGS[chainName];
  if (!cfg) {
    throw new Error(`Unknown chain: ${chainName}`);
  }
  return cfg;
}

export function getChainByChainId(chainId: number): ChainConfig | undefined {
  return Object.values(CHAIN_CONFIGS).find((c) => c.chainId === chainId);
}
