import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Verify HSKIntentAnchor (and HSKRecurringAnchor) on Blockscout.
 *
 * Blockscout's verification API accepts:
 *   POST {explorerUrl}/api/v2/smart-contracts/:address/verification/via/standard-input
 *
 * We send the standard JSON input that Foundry generates in out/<Contract>.json.
 *
 * Usage:
 *   npx tsx scripts/verify-anchor-blockscout.ts \
 *     --address 0xB558d9ceEe9Fe4024c6Be650DD3d3d7D9e22E9bA \
 *     --contract HSKIntentAnchor \
 *     --explorer https://hsk.blockscout.com
 */

interface Args {
  address: string;
  contractName: string;
  explorer: string;
  compilerVersion: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const address = get("--address") ?? process.env.ANCHOR_ADDRESS;
  const contractName = get("--contract") ?? "HSKIntentAnchor";
  const explorer = (get("--explorer") ?? "https://hsk.blockscout.com").replace(/\/$/, "");
  const compilerVersion = get("--compiler") ?? "0.8.28";
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    console.error("Usage: tsx scripts/verify-anchor-blockscout.ts --address 0x... --contract HSKIntentAnchor --explorer https://hsk.blockscout.com");
    process.exit(1);
  }
  return { address, contractName, explorer, compilerVersion };
}

async function main() {
  const { address, contractName, explorer, compilerVersion } = parseArgs();

  const artifactPath = resolve(process.cwd(), "out", `${contractName}.sol`, `${contractName}.json`);
  console.log(`Reading artifact: ${artifactPath}`);
  const artifact = JSON.parse(readFileSync(artifactPath, "utf-8")) as {
    abi: unknown[];
    bytecode: { object: string; linkReferences?: unknown };
  };

  const deployedBytecode = artifact.bytecode.object.startsWith("0x")
    ? artifact.bytecode.object
    : `0x${artifact.bytecode.object}`;

  const body = {
    contractName,
    compilerVersion,
    optimization: true,
    optimizationRuns: 200,
    abi: JSON.stringify(artifact.abi),
    bytecode: deployedBytecode,
    constructorArguments: "",
  };

  const url = `${explorer}/api/v2/smart-contracts/${address}/verification/via/standard-input`;

  console.log(`Verifying ${contractName} at ${address} on ${explorer}…`);
  console.log(`POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    console.log("Response:", JSON.stringify(json, null, 2));
  } catch {
    console.log("Response:", text);
  }

  if (res.ok) {
    console.log("\nVerification submitted! Check the explorer in a moment.");
  } else {
    console.error(`\nVerification failed: HTTP ${res.status}`);
    if (res.status === 409) {
      console.error("Contract may already be verified.");
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
