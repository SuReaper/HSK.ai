import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { contacts, type ContactInsert } from "@/db/schema";

interface RouteParams {
  params: Promise<{ id: string }>;
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

  const patch: Partial<ContactInsert> = {};
  if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim();
  if (typeof body.note === "string") patch.note = body.note;
  if (typeof body.favorite === "boolean") {
    patch.favorite = body.favorite;
    patch.lastUsed = Date.now();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields." }, { status: 400 });
  }

  const existing = db.select().from(contacts).where(eq(contacts.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  db.update(contacts).set(patch).where(eq(contacts.id, id)).run();
  const updated = db.select().from(contacts).where(eq(contacts.id, id)).get();
  return NextResponse.json({ contact: updated });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  ensureDb();
  const { id } = await params;

  const existing = db.select().from(contacts).where(eq(contacts.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  db.delete(contacts).where(eq(contacts.id, id)).run();
  return NextResponse.json({ ok: true });
}
