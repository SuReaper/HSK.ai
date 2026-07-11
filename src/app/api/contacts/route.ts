import { NextResponse } from "next/server";
import { and, desc, eq, or, like } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { contacts } from "@/db/schema";
import { validateCreateContact } from "@/lib/payment";

export async function GET(request: Request) {
  ensureDb();
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();

  const rows = q
    ? db
        .select()
        .from(contacts)
        .where(
          or(
            like(contacts.label, `%${q}%`),
            like(contacts.address, `%${q}%`),
            like(contacts.note, `%${q}%`),
          ),
        )
        .orderBy(desc(contacts.favorite), desc(contacts.lastUsed))
        .all()
    : db
        .select()
        .from(contacts)
        .orderBy(desc(contacts.favorite), desc(contacts.lastUsed))
        .all();

  return NextResponse.json({ contacts: rows });
}

export async function POST(request: Request) {
  ensureDb();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = validateCreateContact({
    label: body.label as string | undefined,
    address: body.address as string | undefined,
    note: body.note as string | null | undefined,
    favorite: body.favorite as boolean | undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const duplicate = db
    .select()
    .from(contacts)
    .where(eq(contacts.address, result.data.address))
    .get();
  if (duplicate) {
    return NextResponse.json(
      { error: "A contact with this address already exists." },
      { status: 409 },
    );
  }

  db.insert(contacts).values(result.data).run();
  return NextResponse.json({ contact: result.data }, { status: 201 });
}

export async function DELETE(request: Request) {
  ensureDb();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id query param." }, { status: 400 });
  }

  const existing = db.select().from(contacts).where(eq(contacts.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  db.delete(contacts)
    .where(and(eq(contacts.id, id)))
    .run();
  return NextResponse.json({ ok: true });
}
