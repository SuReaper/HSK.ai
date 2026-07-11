import { createWalletClient, http, createPublicClient, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { INTENT_ANCHOR_BYTECODE, INTENT_ANCHOR_ABI } from "../src/lib/anchors/anchor-bytecode";

const CHAINS: Record<string, Chain> = {
  testnet: {
    id: 133,
    name: "HashKey Testnet",
    nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
    rpcUrls: { default: { http: ["https://testnet.hsk.xyz"] } },
  } as Chain,
  mainnet: {
    id: 177,
    name: "HashKey",
    nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
    rpcUrls: { default: { http: ["https://mainnet.hsk.xyz"] } },
  } as Chain,
};

async function main() {
  const chainEnv = process.env.ANCHOR_DEPLOY_CHAIN ?? "";
  const keyEnv = process.env.ANCHOR_DEPLOY_PRIVATE_KEY ?? "";

  const chain = CHAINS[chainEnv];
  if (!chain) {
    console.error("Set ANCHOR_DEPLOY_CHAIN to 'testnet' or 'mainnet'.");
    process.exit(1);
  }
  if (!keyEnv || !keyEnv.startsWith("0x")) {
    console.error("Set ANCHOR_DEPLOY_PRIVATE_KEY to a 0x-prefixed funded key.");
    process.exit(1);
  }

  const account = privateKeyToAccount(keyEnv as `0x${string}`);
  const [rpcUrl] = chain.rpcUrls.default.http;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ chain, account, transport: http(rpcUrl) });

  console.log(`Deploying HSKIntentAnchor on ${chain.name} (id ${chain.id}) from ${account.address}…`);

  const txHash = await walletClient.deployContract({
    abi: INTENT_ANCHOR_ABI,
    bytecode: INTENT_ANCHOR_BYTECODE as Hex,
    args: [],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });

  if (receipt.status !== "success" || !receipt.contractAddress) {
    console.error("Deploy FAILED:", txHash);
    process.exit(1);
  }

  console.log("");
  console.log("OK — deployed.");
  console.log("Contract address:", receipt.contractAddress);
  console.log("Deploy tx hash:", txHash);
  if (chain.id === 177) {
    console.log("");
    console.log("Add this to .env.local:");
    console.log(`NEXT_PUBLIC_INTENT_ANCHOR_ADDRESS=${receipt.contractAddress}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
