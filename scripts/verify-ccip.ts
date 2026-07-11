/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import { EVMChain, networkInfo, type CCIPAPIClient as _CCIPAPIClient } from "@chainlink/ccip-sdk";

const ETH_SEPOLIA_ROUTER = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";
const ETH_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

async function main() {
  console.log("=== CCIP Verification: Ethereum Sepolia ===\n");

  const chain = await EVMChain.fromUrl(ETH_SEPOLIA_RPC);
  console.log("Chain connected:", chain.chainId, chain.name);

  // 1. Get the token admin registry for the Router
  console.log("\n--- Token Discovery ---");
  try {
    const registry = await chain.getTokenAdminRegistryFor(ETH_SEPOLIA_ROUTER);
    console.log("Token admin registry:", registry);
    const tokens = await chain.getSupportedTokens(registry);
    console.log(`\nSupported tokens (${tokens.length}):`);
    for (const tokenAddr of tokens) {
      try {
        const info = await chain.getTokenInfo(tokenAddr);
        console.log(`  ${info.symbol} (${info.decimals} decimals): ${tokenAddr}`);
      } catch (_e) {
        console.log(`  ${tokenAddr}: (getInfo failed: ${e})`);
      }
    }
  } catch (e) {
    console.log("Token discovery failed:", e);
  }

  // 2. Get chain selectors for potential dest chains
  console.log("\n--- Chain Selectors ---");
  const candidateNetworkIds = [
    "ethereum-testnet-sepolia-1",
    "ethereum-testnet-sepolia-base-1",
    "ethereum-testnet-sepolia-arbitrum-1",
    "ethereum-testnet-sepolia-optimism-1",
    "ethereum-testnet-sepolia-1-polygon",
    "avalanche-testnet-fuji-1",
  ];
  for (const netId of candidateNetworkIds) {
    try {
      const ni = networkInfo(netId);
      console.log(`  ${netId}: chainSelector = ${ni.chainSelector}`);
    } catch (_e) {
      console.log(`  ${netId}: NOT FOUND`);
    }
  }

  // 3. Try some fee quotes
  console.log("\n--- Fee Quote Test ---");
  try {
    const fee = await chain.getFee({
      router: ETH_SEPOLIA_ROUTER,
      destChainSelector: networkInfo("ethereum-testnet-sepolia-base-1").chainSelector,
      message: {
        receiver: "0x0000000000000000000000000000000000000001",
        data: "0x",
        extraArgs: { gasLimit: 0n },
      },
    });
    console.log("Fee to Base Sepolia (data-only, no tokens):", fee.toString(), "wei");
    console.log("Fee in ETH:", (Number(fee) / 1e18).toFixed(6), "ETH");
  } catch (e) {
    console.log("Fee quote failed:", e);
  }

  // 4. Check isChainSupported
  console.log("\n--- isChainSupported ---");
  for (const netId of candidateNetworkIds) {
    try {
      const sel = networkInfo(netId).chainSelector;
      console.log(`  ${netId} (${sel}): listed in SDK`);
    } catch {
      // skip
    }
  }

  console.log("\n=== Verification Complete ===");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
