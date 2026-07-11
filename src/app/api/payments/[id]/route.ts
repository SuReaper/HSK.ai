import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { payments, type PaymentInsert } from "@/db/schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  ensureDb();
  const { id } = await params;
  const row = db.select().from(payments).where(eq(payments.id, id)).get();
  if (!row) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  return NextResponse.json({ payment: row });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  ensureDb();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Partial<PaymentInsert> = {};
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.txHash === "string") patch.txHash = body.txHash;
  if (typeof body.chainId === "number") patch.chainId = body.chainId;
  if (typeof body.senderAddress === "string") patch.senderAddress = body.senderAddress;
  if (typeof body.tokenAddress === "string") patch.tokenAddress = body.tokenAddress;
  if (typeof body.anchorIntentHash === "string") patch.anchorIntentHash = body.anchorIntentHash;
  if (typeof body.hspPaymentId === "string") patch.hspPaymentId = body.hspPaymentId;
  if (typeof body.hspMandate === "string") patch.hspMandate = body.hspMandate;
  if (typeof body.hspStatus === "string") patch.hspStatus = body.hspStatus;
  if (typeof body.hspDecision === "string") patch.hspDecision = body.hspDecision;
  if (typeof body.hspSettledAt === "number") patch.hspSettledAt = body.hspSettledAt;
  if (typeof body.hspReceipt === "string") patch.hspReceipt = body.hspReceipt;
  if (typeof body.hspVerified === "boolean") patch.hspVerified = body.hspVerified;
  if (typeof body.anchorChainId === "number") patch.anchorChainId = body.anchorChainId;
  if (typeof body.anchorHspPaymentId === "string") patch.anchorHspPaymentId = body.anchorHspPaymentId;
  if (typeof body.anchorTxHash === "string") patch.anchorTxHash = body.anchorTxHash;
  if (typeof body.anchoredAt === "number") patch.anchoredAt = body.anchoredAt;
  if (typeof body.ccipMessageId === "string") patch.ccipMessageId = body.ccipMessageId;
  if (typeof body.ccipSourceChainId === "number") patch.ccipSourceChainId = body.ccipSourceChainId;
  if (typeof body.ccipDestChainId === "number") patch.ccipDestChainId = body.ccipDestChainId;
  if (typeof body.ccipDestChainSelector === "string") patch.ccipDestChainSelector = body.ccipDestChainSelector;
  if (typeof body.viaCcip === "boolean") patch.viaCcip = body.viaCcip;
  if (body.status === "settled" || body.status === "failed") {
    patch.settledAt = Date.now();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields." }, { status: 400 });
  }

  const existing = db.select().from(payments).where(eq(payments.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  db.update(payments).set(patch).where(eq(payments.id, id)).run();
  const updated = db.select().from(payments).where(eq(payments.id, id)).get();
  return NextResponse.json({ payment: updated });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  ensureDb();
  const { id } = await params;

  const existing = db.select().from(payments).where(eq(payments.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  db.delete(payments).where(eq(payments.id, id)).run();
  return NextResponse.json({ ok: true, id });
}
