import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  recipientLabel: text("recipient_label"),
  recipientAddress: text("recipient_address").notNull(),
  token: text("token").notNull().default("USDC"),
  tokenAddress: text("token_address"),
  amountHuman: text("amount_human").notNull(),
  amountBaseUnits: text("amount_base_units").notNull(),
  memo: text("memo"),
  status: text("status").notNull().default("pending"),
  txHash: text("tx_hash"),
  chainId: integer("chain_id").notNull().default(133),
  senderAddress: text("sender_address"),
  createdAt: integer("created_at").notNull(),
  settledAt: integer("settled_at"),
  hspPaymentId: text("hsp_payment_id"),
  hspMandate: text("hsp_mandate"),
  hspStatus: text("hsp_status"),
  hspVerified: integer("hsp_verified", { mode: "boolean" }),
  hspDecision: text("hsp_decision"),
  hspSettledAt: integer("hsp_settled_at"),
  hspReceipt: text("hsp_receipt"),
  anchorIntentHash: text("anchor_intent_hash"),
  anchorChainId: integer("anchor_chain_id"),
  anchorHspPaymentId: text("anchor_hsp_payment_id"),
  anchorTxHash: text("anchor_tx_hash"),
  anchoredAt: integer("anchored_at"),
  ccipMessageId: text("ccip_message_id"),
  ccipSourceChainId: integer("ccip_source_chain_id"),
  ccipDestChainId: integer("ccip_dest_chain_id"),
  ccipDestChainSelector: text("ccip_dest_chain_selector"),
  viaCcip: integer("via_ccip", { mode: "boolean" }).notNull().default(false),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  address: text("address").notNull().unique(),
  note: text("note").default(""),
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
  lastUsed: integer("last_used").notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("system"),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  relatedPaymentId: text("related_payment_id"),
  createdAt: integer("created_at").notNull(),
});

export type PaymentRow = typeof payments.$inferSelect;
export type PaymentInsert = typeof payments.$inferInsert;
export type ContactRow = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;
export type NotificationRow = typeof notifications.$inferSelect;
export type NotificationInsert = typeof notifications.$inferInsert;

export const recurringSchedules = sqliteTable("recurring_schedules", {
  id: text("id").primaryKey(),
  recipientLabel: text("recipient_label"),
  recipientAddress: text("recipient_address").notNull(),
  token: text("token").notNull().default("USDC"),
  tokenAddress: text("token_address"),
  amountHuman: text("amount_human").notNull(),
  amountBaseUnits: text("amount_base_units").notNull(),
  cadence: text("cadence").notNull(),
  nextFireAt: integer("next_fire_at").notNull(),
  lastFireAt: integer("last_fire_at"),
  executions: integer("executions").notNull().default(0),
  maxExecutions: integer("max_executions").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  scheduleIdHash: text("schedule_id_hash").notNull(),
  anchorChainId: integer("anchor_chain_id").notNull().default(177),
  anchorTxHash: text("anchor_tx_hash"),
  senderAddress: text("sender_address"),
  createdAt: integer("created_at").notNull(),
  userId: text("user_id"),
});

export type RecurringRow = typeof recurringSchedules.$inferSelect;
export type RecurringInsert = typeof recurringSchedules.$inferInsert;
