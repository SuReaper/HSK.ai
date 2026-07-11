import { getAddress, type Address } from "viem";

const ROUTER_ADDRESSES: Record<number, string | undefined> = {
  11155111: process.env.NEXT_PUBLIC_CCIP_ROUTER_11155111 ?? "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
  1: process.env.NEXT_PUBLIC_CCIP_ROUTER_1 ?? "",
};

export function isCcipConfigured(chainId?: number): boolean {
  if (!chainId) return false;
  const raw = ROUTER_ADDRESSES[chainId];
  return !!raw && raw.length === 42;
}

export function ccipRouterAddress(chainId: number): Address {
  const raw = ROUTER_ADDRESSES[chainId];
  if (!raw || raw.length !== 42) {
    throw new Error(`CCIP Router not configured for chain ${chainId}`);
  }
  return getAddress(raw);
}

export function getSrcRpcUrl(chainId: number | undefined): string {
  switch (chainId) {
    case 11155111: return "https://ethereum-sepolia-rpc.publicnode.com";
    case 1: return "https://eth.llamarpc.com";
    default: return "https://ethereum-sepolia-rpc.publicnode.com";
  }
}
