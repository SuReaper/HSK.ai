import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/db";
import { payments } from "@/db/schema";
import { syncPayment } from "@/lib/hsp/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Pulls the latest HSP coordinator state for a payment and updates the DB row.
 * Use this when the on-chain settle succeeded on-chain but the HSP observe
 * timed out (DB says "sent" / hspStatus "PENDING"), but the coordinator may
 * have since reached a terminal status (SETTLED / FAILED) asynchronously.
 *
 * The coordinator's `/payments/{id}` endpoint is public — no API key required
 * for read — so this route works even without an HSP_API_KEY.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  ensureDb();
  const { id } = await params;

  const row = db.select().from(payments).where(eq(payments.id, id)).get();
  if (!row) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  if (!row.hspPaymentId) {
    return NextResponse.json({ error: "Payment has no HSP payment ID — nothing to sync." }, { status: 400 });
  }

  // Already in a terminal HSP state + DB reflects it → nothing to do.
  const TERMINAL = new Set(["SETTLED", "FAILED", "DISPUTED", "EXPIRED"]);
  if (row.hspStatus && TERMINAL.has(row.hspStatus) && (row.status === "settled" || row.status === "failed")) {
    return NextResponse.json({ payment: row, synced: false, reason: "already terminal" });
  }

  try {
    const result = await syncPayment(row, row.chainId);
    if (!result) {
      return NextResponse.json({
        payment: row,
        synced: false,
        reason: "coordinator unreachable or no status update",
      });
    }

    const finalStatus =
      result.hspStatus === "SETTLED" && result.hspVerified
        ? "settled"
        : result.hspStatus !== null && TERMINAL.has(result.hspStatus) && result.hspStatus !== "SETTLED"
          ? "failed"
          : row.status;

    db.update(payments)
      .set({
        hspStatus: result.hspStatus,
        hspVerified: result.hspVerified,
        hspDecision: result.hspDecision,
        hspSettledAt: result.hspSettledAt,
        hspReceipt: result.hspReceipt ? JSON.stringify(result.hspReceipt) : row.hspReceipt,
        status: finalStatus,
        settledAt:
          finalStatus === "settled"
            ? result.hspSettledAt ?? Date.now()
            : row.settledAt,
      })
      .where(eq(payments.id, id))
      .run();

    const updated = db.select().from(payments).where(eq(payments.id, id)).get();
    return NextResponse.json({
      payment: updated,
      synced: true,
      hspStatus: result.hspStatus,
      hspVerified: result.hspVerified,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed.";
    return NextResponse.json({ error: message, payment: row, synced: false }, { status: 500 });
  }
}
