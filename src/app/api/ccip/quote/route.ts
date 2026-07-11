import { NextResponse } from "next/server";
import { EVMChain } from "@chainlink/ccip-sdk";
import { ccipRouterAddress, getSrcRpcUrl } from "@/lib/ccip/config";
import { CCIP_SOURCE_CHAIN_ID } from "@/lib/ccip/dest-chains";

interface QuoteBody {
  sourceChainId: number;
  destChainSelector: string;
  receiver: string;
  tokenAddress: string;
  tokenAmount: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as QuoteBody;
    const sourceChainId = body.sourceChainId || CCIP_SOURCE_CHAIN_ID;
    const rpcUrl = getSrcRpcUrl(sourceChainId);
    const router = ccipRouterAddress(sourceChainId);

    const chain = await EVMChain.fromUrl(rpcUrl);
    const fee = await chain.getFee({
      router,
      destChainSelector: BigInt(body.destChainSelector),
      message: {
        receiver: body.receiver,
        data: "0x",
        tokenAmounts: [
          { token: body.tokenAddress, amount: BigInt(body.tokenAmount) },
        ],
        extraArgs: { gasLimit: 0n, allowOutOfOrderExecution: true },
      },
    });

    return NextResponse.json({
      fee: fee.toString(),
      feeTokenSymbol: "ETH",
      isSupported: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Quote failed";
    const isUnsupported = msg.toLowerCase().includes("unsupported") || msg.toLowerCase().includes("not found");
    return NextResponse.json(
      { error: msg, fee: "0", feeTokenSymbol: "ETH", isSupported: false },
      { status: isUnsupported ? 400 : 500 },
    );
  }
}
