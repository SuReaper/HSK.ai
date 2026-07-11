import { getAddress, type Address } from "viem";

export const RECURRING_CHAIN_ID = 177 as const;

function safeAddress(raw: string): Address {
  return raw.length === 42 ? getAddress(raw) : ("0x" as Address);
}

export const RECURRING_ADDRESSES: Record<number, Address> = {
  133: safeAddress(process.env.NEXT_PUBLIC_RECURRING_ADDRESS_TESTNET ?? ""),
  177: safeAddress(process.env.NEXT_PUBLIC_RECURRING_ADDRESS_MAINNET ?? ""),
};

const rawLegacy = process.env.NEXT_PUBLIC_RECURRING_ANCHOR_ADDRESS ?? "";
if (rawLegacy.length === 42 && RECURRING_ADDRESSES[177] === "0x") {
  RECURRING_ADDRESSES[177] = getAddress(rawLegacy);
}

export const RECURRING_ADDRESS: Address = RECURRING_ADDRESSES[RECURRING_CHAIN_ID];

export function isRecurringConfigured(): boolean {
  return RECURRING_ADDRESS.length === 42 && RECURRING_ADDRESS !== "0x";
}

export function getRecurringAddress(chainId: number): Address | null {
  const addr = RECURRING_ADDRESSES[chainId];
  return addr && addr !== "0x" ? addr : null;
}

export const RECURRING_EXPLORERS: Record<number, string> = {
  133: "https://testnet-explorer.hsk.xyz",
  177: "https://hashkey.blockscout.com",
};
