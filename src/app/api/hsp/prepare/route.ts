import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { encodeFunctionData, erc20Abi, getAddress, createPublicClient, http, parseUnits } from "viem";
import { mandateTypedData } from "@hsp/sdk";
import { buildMandate } from "@/lib/hsp/server";
import { getHspConfig } from "@/lib/hsp/config";
import { db, ensureDb } from "@/db";
import { payments } from "@/db/schema";

export async function POST(request: Request) {
  ensureDb();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const dbPaymentId = body.dbPaymentId as string | undefined;
  const walletChainId = typeof body.chainId === "number" ? body.chainId : undefined;
  if (!dbPaymentId) {
    return NextResponse.json({ error: "Missing required field: dbPaymentId." }, { status: 400 });
  }

  const row = db.select().from(payments).where(eq(payments.id, dbPaymentId)).get();
  if (!row) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (row.status !== "pending" && row.status !== "signing") {
    return NextResponse.json({ error: `Payment is already ${row.status}.` }, { status: 400 });
  }
  if (!row.senderAddress) {
    return NextResponse.json({ error: "Payment has no sender address." }, { status: 400 });
  }

  const config = getHspConfig(walletChainId);
  const tokenSym = (row.token ?? "").toUpperCase();
  const isStablecoinSymbol = tokenSym === "USDC" || tokenSym === "USDC.E";
  const storedAddr = row.tokenAddress?.trim();
  const isNativeSym = tokenSym === "HSK" || tokenSym === "ETH";

  if (!storedAddr && !isStablecoinSymbol) {
    return NextResponse.json(
      {
        error: isNativeSym
          ? `Native ${tokenSym} transfers use a plain wallet send, not the HSP ERC-20 settle flow.`
          : `Token "${row.token}" has no contract address on file.`,
      },
      { status: 400 },
    );
  }

  const tokenAddress = storedAddr ? getAddress(storedAddr) : config.chain.stablecoin.address;

  try {
    const publicClient = createPublicClient({ transport: http(config.chain.rpcUrl) });

    let decimals: number | null = null;
    try {
      decimals = (await Promise.race([
        publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "decimals",
        }) as Promise<number>,
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
      ])) as number;
    } catch {
      decimals = null;
    }

    let amountBaseUnits: string;
    if (decimals != null) {
      amountBaseUnits = parseUnits(row.amountHuman, decimals).toString();
    } else {
      const guess = isStablecoinSymbol ? 6 : null;
      amountBaseUnits =
        guess != null ? parseUnits(row.amountHuman, guess).toString() : row.amountBaseUnits;
    }

    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const { body: mandateBody, mandateHash: paymentId } = buildMandate({
      payer: getAddress(row.senderAddress),
      to: getAddress(row.recipientAddress),
      amount: amountBaseUnits,
      token: tokenAddress,
      deadline,
      chainId: walletChainId,
    });

    const typedData = mandateTypedData(config.domain, mandateBody);

    const settleTxData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [getAddress(row.recipientAddress), BigInt(amountBaseUnits)],
    });

    return NextResponse.json({
      paymentId,
      mandateBody,
      typedData,
      settleTx: {
        to: tokenAddress,
        data: settleTxData,
        chainId: config.chain.chainId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prepare failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
