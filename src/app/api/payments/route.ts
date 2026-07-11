import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { payments } from "@/db/schema";
import { validateCreatePayment } from "@/lib/payment";

export async function GET() {
  ensureDb();
  const rows = db.select().from(payments).orderBy(desc(payments.createdAt)).all();
  return NextResponse.json({ payments: rows });
}

export async function POST(request: Request) {
  ensureDb();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = validateCreatePayment({
    recipientAddress: body.recipientAddress as string | undefined,
    recipientLabel: body.recipientLabel as string | null | undefined,
    token: body.token as string | undefined,
    tokenAddress: body.tokenAddress as string | null | undefined,
    amountHuman: body.amountHuman as string | undefined,
    memo: body.memo as string | null | undefined,
    chainId: body.chainId as number | undefined,
    senderAddress: body.senderAddress as string | null | undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  db.insert(payments).values(result.data).run();
  return NextResponse.json({ payment: result.data }, { status: 201 });
}
