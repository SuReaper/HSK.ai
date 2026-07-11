/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import * as sdk from "@chainlink/ccip-sdk";
const { SELECTORS, supportedChains, networkInfo } = sdk;

console.log("=== SELECTORS export ===");
console.log("Type:", typeof SELECTORS);
if (SELECTORS) {
  if (SELECTORS instanceof Map) {
    console.log("Size:", SELECTORS.size);
    let i = 0;
    for (const [k, v] of SELECTORS) {
      console.log(`  ${k}: ${v}`);
      if (++i > 50) { console.log("  ... (truncated)"); break; }
    }
  } else if (typeof SELECTORS === "object") {
    const entries = Object.entries(SELECTORS);
    console.log("Entries:", entries.length);
    for (const [k, v] of entries.slice(0, 50)) {
      console.log(`  ${k}: ${v}`);
    }
    if (entries.length > 50) console.log("  ... (truncated)");
  }
}

console.log("\n=== supportedChains export ===");
console.log("Type:", typeof supportedChains);
if (supportedChains) {
  if (Array.isArray(supportedChains)) {
    console.log("Length:", supportedChains.length);
    const testnet = supportedChains.filter((c: any) => c?.type === "testnet" || c?.networkType === "testnet" || String(c?.id ?? c?.networkId ?? "").includes("testnet") || String(c?.id ?? c?.networkId ?? "").includes("sepolia") || String(c?.id ?? c?.networkId ?? "").includes("fuji") || String(c?.id ?? c?.networkId ?? "").includes("amoy"));
    console.log(`\nTestnet chains (${testnet.length}):`);
    for (const c of testnet) {
      console.log(" ", JSON.stringify(c));
    }
    console.log(`\nAll chains (${supportedChains.length}):`);
    for (const c of supportedChains) {
      if (typeof c === "string") console.log(" ", c);
      else console.log(" ", c?.id ?? c?.networkId ?? c?.name ?? JSON.stringify(c));
    }
  } else if (typeof supportedChains === "object") {
    const entries = Object.entries(supportedChains);
    console.log("Keys:", entries.length);
    for (const [k, v] of entries.slice(0, 80)) {
      console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
    }
  }
}

// Also try known Ethereum Sepolia related IDs
console.log("\n=== Ethereum Sepolia as source ===");
const sepoliaIds = [
  "ethereum-testnet-sepolia-1",
  "ethereum-testnet-sepolia",
  "ethereum-sepolia",
  "sepolia",
];
for (const id of sepoliaIds) {
  try {
    const info = networkInfo(id) as any;
    console.log(`  "${id}" -> chainSelector=${info.chainSelector}, chainId=${info.chainId}`);
  } catch {
    console.log(`  "${id}" -> NOT FOUND`);
  }
}

console.log("\n=== Polygon & Avalanche ===");
const polygonIds = [
  "polygon-testnet-amoy",
  "polygon-amoy",
  "matic-testnet-amoy",
  "ethereum-testnet-sepolia-polygon-1",
  "arbitrum-testnet-sepolia-polygon-1",
];
for (const id of polygonIds) {
  try {
    const info = networkInfo(id) as any;
    console.log(`  "${id}" -> chainSelector=${info.chainSelector}, chainId=${info.chainId}`);
  } catch {
    console.log(`  "${id}" -> NOT FOUND`);
  }
}
const fujiIds = [
  "avalanche-testnet-fuji-1",
  "avalanche-fuji",
  "avalanche-testnet-fuji",
  "ethereum-testnet-sepolia-avalanche-1",
];
for (const id of fujiIds) {
  try {
    const info = networkInfo(id) as any;
    console.log(`  "${id}" -> chainSelector=${info.chainSelector}, chainId=${info.chainId}`);
  } catch {
    console.log(`  "${id}" -> NOT FOUND`);
  }
}

console.log("\n=== Done ===");
