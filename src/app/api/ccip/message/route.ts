import { NextResponse } from "next/server";
import { EVMChain } from "@chainlink/ccip-sdk";
import { getSrcRpcUrl } from "@/lib/ccip/config";
import { CCIP_SOURCE_CHAIN_ID } from "@/lib/ccip/dest-chains";

interface MessageBody {
  sourceChainId: number;
  txHash: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MessageBody;
    const sourceChainId = body.sourceChainId || CCIP_SOURCE_CHAIN_ID;
    const rpcUrl = getSrcRpcUrl(sourceChainId);

    const chain = await EVMChain.fromUrl(rpcUrl);
    const requests = await chain.getMessagesInTx(body.txHash);
    const req0 = requests[0];

    if (!req0) {
      return NextResponse.json(
        { error: "No CCIP message found in transaction" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      messageId: req0.message.messageId,
      destChainSelector: req0.lane.destChainSelector.toString(),
      sender: req0.message.sender,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Message extraction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
