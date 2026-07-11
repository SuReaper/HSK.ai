import { v4 as uuidv4 } from "uuid";
import { db } from "@/db/index";
import { notifications } from "@/db/schema";

export type NotificationType = "payment" | "security" | "system";

export function createNotification(
  title: string,
  message: string,
  type: NotificationType,
  relatedPaymentId?: string,
) {
  const id = uuidv4();
  db.insert(notifications)
    .values({
      id,
      title,
      message,
      type,
      read: false,
      relatedPaymentId: relatedPaymentId ?? null,
      createdAt: Date.now(),
    })
    .run();
  return id;
}

export function createPaymentNotification(
  event: string,
  token: string,
  amountHuman: string,
  recipientLabel: string,
  paymentId: string,
) {
  const eventMap: Record<string, { title: string; message: string }> = {
    initiated: {
      title: "Payment initiated",
      message: `${amountHuman} ${token} to ${recipientLabel}`,
    },
    settling: {
      title: "Broadcasting transaction",
      message: `${amountHuman} ${token} to ${recipientLabel} — transfer sent`,
    },
    settled: {
      title: "Payment settled",
      message: `${amountHuman} ${token} to ${recipientLabel} settled on-chain`,
    },
    failed: {
      title: "Payment failed",
      message: `${amountHuman} ${token} to ${recipientLabel} failed`,
    },
  };

  const info = eventMap[event];
  if (!info) return;

  createNotification(info.title, info.message, "payment", paymentId);
}
