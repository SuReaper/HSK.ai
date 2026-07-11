import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { recurringSchedules } from "@/db/schema";

export async function GET(request: Request) {
  ensureDb();
  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("active") === "true";

  let query = db.select().from(recurringSchedules).orderBy(desc(recurringSchedules.createdAt));
  if (activeOnly) {
    query = query.where(eq(recurringSchedules.active, true)) as typeof query;
  }
  const rows = query.all();
  return NextResponse.json({ schedules: rows });
}

export async function POST(request: Request) {
  ensureDb();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const required = ["id", "recipientAddress", "amountHuman", "amountBaseUnits", "cadence", "nextFireAt", "maxExecutions", "scheduleIdHash", "senderAddress"] as const;
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  const row = {
    id: body.id as string,
    recipientLabel: (body.recipientLabel as string) ?? null,
    recipientAddress: body.recipientAddress as string,
    token: (body.token as string) ?? "USDC",
    tokenAddress: (body.tokenAddress as string) ?? null,
    amountHuman: body.amountHuman as string,
    amountBaseUnits: body.amountBaseUnits as string,
    cadence: body.cadence as string,
    nextFireAt: body.nextFireAt as number,
    maxExecutions: body.maxExecutions as number,
    scheduleIdHash: body.scheduleIdHash as string,
    anchorChainId: (body.anchorChainId as number) ?? 177,
    anchorTxHash: (body.anchorTxHash as string) ?? null,
    senderAddress: body.senderAddress as string,
    createdAt: Date.now(),
    active: true,
    executions: 0,
    lastFireAt: null,
    userId: (body.userId as string) ?? null,
  };

  db.insert(recurringSchedules).values(row).run();
  return NextResponse.json({ schedule: row }, { status: 201 });
}
