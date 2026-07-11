import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { recurringSchedules } from "@/db/schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  ensureDb();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.active !== undefined) updates.active = body.active ? 1 : 0;
  if (body.executions !== undefined) updates.executions = body.executions;
  if (body.lastFireAt !== undefined) updates.lastFireAt = body.lastFireAt;
  if (body.nextFireAt !== undefined) updates.nextFireAt = body.nextFireAt;
  if (body.anchorTxHash !== undefined) updates.anchorTxHash = body.anchorTxHash;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  db.update(recurringSchedules).set(updates).where(eq(recurringSchedules.id, id)).run();
  const row = db.select().from(recurringSchedules).where(eq(recurringSchedules.id, id)).get();
  return NextResponse.json({ schedule: row });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  ensureDb();
  const { id } = await params;
  db.update(recurringSchedules).set({ active: false }).where(eq(recurringSchedules.id, id)).run();
  return NextResponse.json({ ok: true });
}
