import { NextResponse } from "next/server";
import { db, ensureDb } from "@/db/index";
import { notifications } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    ensureDb();
    db.update(notifications).set({ read: true }).where(eq(notifications.read, false)).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
