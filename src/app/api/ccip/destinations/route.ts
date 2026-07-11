import { NextResponse } from "next/server";
import {
  CCIP_DEST_CHAINS,
  CCIP_SOURCE_CHAIN_ID,
} from "@/lib/ccip/dest-chains";

export async function GET() {
  try {
    const dests = CCIP_DEST_CHAINS.map((dest) => ({
      name: dest.name,
      chainId: dest.chainId,
      chainSelector: dest.chainSelector.toString(),
      testnet: dest.testnet,
      explorerUrl: dest.explorerUrl,
    }));

    return NextResponse.json({
      destinations: dests,
      sourceChainId: CCIP_SOURCE_CHAIN_ID,
      sourceChainName: "Ethereum Sepolia",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
