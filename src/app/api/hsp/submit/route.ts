import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { payments } from "@/db/schema";
import { observeAndSettle } from "@/lib/hsp/server";
import type { Mandate } from "@hsp/core";
import type { Hex } from "viem";

/**
 * Called AFTER the on-chain transfer is broadcast.
 * Hands the txHash to the HSP Coordinator so it can observe the transfer,
 * emit a signed Receipt, and settle.
 */
export async function POST(request: Request) {
  ensureDb();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const dbPaymentId = body.dbPaymentId as string | undefined;
  const paymentId = body.paymentId as Hex | undefined;
  const mandateBody = body.mandateBody as Mandate | undefined;
  const mandateSignature = body.mandateSignature as Hex | undefined;
  const txHash = body.txHash as Hex | undefined;
  const walletChainId = typeof body.chainId === "number" ? body.chainId : undefined;

  if (!dbPaymentId || !paymentId || !mandateBody || !mandateSignature || !txHash) {
    return NextResponse.json(
      { error: "Missing required fields: dbPaymentId, paymentId, mandateBody, mandateSignature, txHash." },
      { status: 400 },
    );
  }

  const existing = db.select().from(payments).where(eq(payments.id, dbPaymentId)).get();
  if (!existing) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  try {
    const result = await observeAndSettle({ paymentId, mandateBody, mandateSignature, txHash, chainId: walletChainId });

    const finalStatus =
      result.hspStatus === "SETTLED" && result.hspVerified
        ? "settled"
        : "sent";

    db.update(payments)
      .set({
        hspStatus: result.hspStatus,
        hspVerified: result.hspVerified,
        hspDecision: result.hspDecision,
        hspSettledAt: result.hspSettledAt,
        hspReceipt: result.hspReceipt ? JSON.stringify(result.hspReceipt) : existing.hspReceipt,
        status: finalStatus,
        txHash,
        settledAt:
          finalStatus === "settled"
            ? result.hspSettledAt ?? Date.now()
            : existing.settledAt,
      })
      .where(eq(payments.id, dbPaymentId))
      .run();

    return NextResponse.json({
      hspStatus: result.hspStatus,
      hspVerified: result.hspVerified,
      hspDecision: result.hspDecision,
      status: finalStatus,
      txHash,
      error: result.error,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submit failed.";
    db.update(payments)
      .set({ status: "sent", txHash, hspStatus: "FAILED", hspDecision: "OBSERVE_ERROR" })
      .where(eq(payments.id, dbPaymentId))
      .run();
    return NextResponse.json({
      status: "sent",
      hspStatus: "FAILED",
      hspVerified: false,
      hspDecision: "OBSERVE_ERROR",
      txHash,
      error: message,
    });
  }
}
