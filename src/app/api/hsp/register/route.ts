import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { payments } from "@/db/schema";
import { registerMandate } from "@/lib/hsp/server";
import type { Mandate } from "@hsp/core";
import type { Hex } from "viem";

/**
 * Called BEFORE the on-chain transfer is broadcast.
 * Registers the signed mandate with the HSP Coordinator.
 * If the Coordinator rejects (policy floor violation, bad signature, etc.)
 * the client aborts — no money moves.
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
  const walletChainId = typeof body.chainId === "number" ? body.chainId : undefined;

  if (!dbPaymentId || !paymentId || !mandateBody || !mandateSignature) {
    return NextResponse.json(
      { error: "Missing required fields: dbPaymentId, paymentId, mandateBody, mandateSignature." },
      { status: 400 },
    );
  }

  const existing = db.select().from(payments).where(eq(payments.id, dbPaymentId)).get();
  if (!existing) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  try {
    const result = await registerMandate({ paymentId, mandateBody, mandateSignature, chainId: walletChainId });

    if (!result.ok) {
      db.update(payments)
        .set({ hspPaymentId: paymentId, hspStatus: "FAILED", hspDecision: "REGISTER_REJECTED" })
        .where(eq(payments.id, dbPaymentId))
        .run();
      return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
    }

    db.update(payments)
      .set({
        hspPaymentId: paymentId,
        hspMandate: JSON.stringify(mandateBody),
        hspStatus: "REGISTERED",
      })
      .where(eq(payments.id, dbPaymentId))
      .run();

    return NextResponse.json({ ok: true, hspPaymentId: paymentId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Register failed.";
    db.update(payments)
      .set({ hspPaymentId: paymentId, hspStatus: "FAILED", hspDecision: "REGISTER_ERROR" })
      .where(eq(payments.id, dbPaymentId))
      .run();
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
