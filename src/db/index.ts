import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { contacts, payments, notifications, recurringSchedules } from "@/db/schema";

export type AppDatabase = BetterSQLite3Database<{
  contacts: typeof contacts;
  payments: typeof payments;
  notifications: typeof notifications;
  recurringSchedules: typeof recurringSchedules;
}>;

const DB_PATH = path.join(process.cwd(), "sqlite.db");

const globalForDb = globalThis as unknown as {
  __sqlite?: Database.Database;
  __db?: AppDatabase;
};

const sqlite =
  globalForDb.__sqlite ??
  (() => {
    const instance = new Database(DB_PATH);
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
    return instance;
  })();

if (!globalForDb.__sqlite) {
  globalForDb.__sqlite = sqlite;
}

export const db: AppDatabase =
  globalForDb.__db ??
  drizzle(sqlite, { schema: { contacts, payments, notifications, recurringSchedules } });

if (!globalForDb.__db) {
  globalForDb.__db = db;
}

let initialized = false;

export function ensureDb(): void {
  if (initialized) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      recipient_label TEXT,
      recipient_address TEXT NOT NULL,
      token TEXT NOT NULL DEFAULT 'USDC',
      token_address TEXT,
      amount_human TEXT NOT NULL,
      amount_base_units TEXT NOT NULL,
      memo TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      tx_hash TEXT,
      chain_id INTEGER NOT NULL DEFAULT 133,
      sender_address TEXT,
      created_at INTEGER NOT NULL,
      settled_at INTEGER,
      hsp_payment_id TEXT,
      hsp_mandate TEXT,
      hsp_status TEXT,
      hsp_verified INTEGER,
      hsp_decision TEXT,
      hsp_settled_at INTEGER,
      hsp_receipt TEXT,
      anchor_intent_hash TEXT,
      anchor_chain_id INTEGER,
      anchor_hsp_payment_id TEXT,
      anchor_tx_hash TEXT,
      anchored_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      address TEXT NOT NULL UNIQUE,
      note TEXT DEFAULT '',
      favorite INTEGER NOT NULL DEFAULT 0,
      last_used INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'system',
      read INTEGER NOT NULL DEFAULT 0,
      related_payment_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_contacts_last_used ON contacts(last_used DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

    CREATE TABLE IF NOT EXISTS recurring_schedules (
      id TEXT PRIMARY KEY,
      recipient_label TEXT,
      recipient_address TEXT NOT NULL,
      token TEXT NOT NULL DEFAULT 'USDC',
      token_address TEXT,
      amount_human TEXT NOT NULL,
      amount_base_units TEXT NOT NULL,
      cadence TEXT NOT NULL,
      next_fire_at INTEGER NOT NULL,
      last_fire_at INTEGER,
      executions INTEGER NOT NULL DEFAULT 0,
      max_executions INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      schedule_id_hash TEXT NOT NULL,
      anchor_chain_id INTEGER NOT NULL DEFAULT 177,
      anchor_tx_hash TEXT,
      sender_address TEXT,
      created_at INTEGER NOT NULL,
      user_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_schedules(active);
    CREATE INDEX IF NOT EXISTS idx_recurring_next_fire ON recurring_schedules(next_fire_at);
    CREATE INDEX IF NOT EXISTS idx_recurring_created ON recurring_schedules(created_at DESC);
  `);

  migrateColumns();
  fixStuckSettling();

  initialized = true;
}

function migrateColumns(): void {
  const existing = sqlite
    .prepare("PRAGMA table_info(payments)")
    .all() as Array<{ name: string }>;
  const present = new Set(existing.map((c) => c.name));

  const adds: Array<{ col: string; ddl: string }> = [
    { col: "token_address", ddl: "TEXT" },
    { col: "hsp_payment_id", ddl: "TEXT" },
    { col: "hsp_mandate", ddl: "TEXT" },
    { col: "hsp_status", ddl: "TEXT" },
    { col: "hsp_verified", ddl: "INTEGER" },
    { col: "hsp_decision", ddl: "TEXT" },
    { col: "hsp_settled_at", ddl: "INTEGER" },
    { col: "hsp_receipt", ddl: "TEXT" },
    { col: "anchor_intent_hash", ddl: "TEXT" },
    { col: "anchor_chain_id", ddl: "INTEGER" },
    { col: "anchor_hsp_payment_id", ddl: "TEXT" },
    { col: "anchor_tx_hash", ddl: "TEXT" },
    { col: "anchored_at", ddl: "INTEGER" },
    { col: "ccip_message_id", ddl: "TEXT" },
    { col: "ccip_source_chain_id", ddl: "INTEGER" },
    { col: "ccip_dest_chain_id", ddl: "INTEGER" },
    { col: "ccip_dest_chain_selector", ddl: "TEXT" },
    { col: "via_ccip", ddl: "INTEGER NOT NULL DEFAULT 0" },
  ];

  for (const { col, ddl } of adds) {
    if (!present.has(col)) {
      sqlite.exec(`ALTER TABLE payments ADD COLUMN ${col} ${ddl};`);
    }
  }
}

/** One-time fix: payments that have a tx_hash but are stuck in 'settling' should be 'settled'. */
function fixStuckSettling(): void {
  try {
    sqlite.exec(
      `UPDATE payments SET status = 'settled', settled_at = COALESCE(settled_at, created_at) WHERE status = 'settling' AND tx_hash IS NOT NULL AND tx_hash != ''`,
    );
    sqlite.exec(
      `UPDATE payments SET status = 'settled', settled_at = COALESCE(settled_at, created_at) WHERE status = 'sent' AND hsp_status = 'SETTLED' AND hsp_verified = 1`,
    );
  } catch {
    // non-critical
  }
}

