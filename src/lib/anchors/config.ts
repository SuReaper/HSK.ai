import { getAddress, type Address } from "viem";

export const INTENT_ANCHOR_CHAIN_ID = 177 as const;

function safeAddress(raw: string): Address {
  return raw.length === 42 ? getAddress(raw) : ("0x" as Address);
}

export const ANCHOR_ADDRESSES: Record<number, Address> = {
  133: safeAddress(process.env.NEXT_PUBLIC_INTENT_ANCHOR_ADDRESS_TESTNET ?? ""),
  177: safeAddress(process.env.NEXT_PUBLIC_INTENT_ANCHOR_ADDRESS_MAINNET ?? ""),
};

const rawLegacy = process.env.NEXT_PUBLIC_INTENT_ANCHOR_ADDRESS ?? "";
if (rawLegacy.length === 42 && ANCHOR_ADDRESSES[177] === "0x") {
  ANCHOR_ADDRESSES[177] = getAddress(rawLegacy);
}

export const INTENT_ANCHOR_ADDRESS: Address = ANCHOR_ADDRESSES[INTENT_ANCHOR_CHAIN_ID];

export function isAnchorConfigured(): boolean {
  return INTENT_ANCHOR_ADDRESS.length === 42 && INTENT_ANCHOR_ADDRESS !== "0x";
}

export function getAnchorAddress(chainId: number): Address | null {
  const addr = ANCHOR_ADDRESSES[chainId];
  return addr && addr !== "0x" ? addr : null;
}

export const ANCHOR_EXPLORERS: Record<number, string> = {
  133: "https://testnet-explorer.hsk.xyz",
  177: "https://hashkey.blockscout.com",
};

export const ANCHOR_MAINNET_EXPLORER = "https://hashkey.blockscout.com";
