"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ContactRow, PaymentRow } from "@/db/schema";

export type Payment = PaymentRow;
export type Contact = ContactRow;

const PAYMENTS_KEY = ["payments"] as const;
const CONTACTS_KEY = ["contacts"] as const;

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? "Request failed");
  }
  return (await res.json()) as T;
}

export interface CreatePaymentPayload {
  recipientAddress: string;
  recipientLabel: string | null;
  token: string;
  tokenAddress?: string | null;
  amountHuman: string;
  memo?: string | null;
  chainId: number;
  senderAddress: string | null;
}

export interface UpdatePaymentPayload {
  id: string;
  status?: string;
  txHash?: string;
  chainId?: number;
  senderAddress?: string | null;
  tokenAddress?: string | null;
  hspPaymentId?: string | null;
  hspMandate?: string | null;
  hspStatus?: string | null;
  hspVerified?: boolean | null;
  hspDecision?: string | null;
  hspSettledAt?: number | null;
  hspReceipt?: string | null;
  anchorIntentHash?: string | null;
  anchorChainId?: number | null;
  anchorHspPaymentId?: string | null;
  anchorTxHash?: string | null;
  anchoredAt?: number | null;
  ccipMessageId?: string | null;
  ccipSourceChainId?: number | null;
  ccipDestChainId?: number | null;
  ccipDestChainSelector?: string | null;
  viaCcip?: boolean | null;
}

export interface CreateContactPayload {
  label: string;
  address: string;
  note?: string;
  favorite?: boolean;
}

export interface UpdateContactPayload {
  id: string;
  label?: string;
  note?: string;
  favorite?: boolean;
}

export function usePayments() {
  return useQuery({
    queryKey: PAYMENTS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/payments", { cache: "no-store" });
      const data = await parseJson<{ payments: Payment[] }>(res);
      return data.payments;
    },
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePaymentPayload) => {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJson<{ payment: Payment }>(res);
      return data.payment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENTS_KEY }),
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePaymentPayload) => {
      const res = await fetch(`/api/payments/${payload.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJson<{ payment: Payment }>(res);
      return data.payment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENTS_KEY }),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
      await parseJson<{ ok: boolean }>(res);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENTS_KEY }),
  });
}

export function useSyncPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payments/${id}/sync`, { method: "POST" });
      const data = await parseJson<{
        payment: Payment;
        synced: boolean;
        hspStatus?: string | null;
        hspVerified?: boolean | null;
        reason?: string;
      }>(res);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENTS_KEY }),
  });
}

export function useContacts() {
  return useQuery({
    queryKey: CONTACTS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/contacts", { cache: "no-store" });
      const data = await parseJson<{ contacts: Contact[] }>(res);
      return data.contacts;
    },
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateContactPayload) => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJson<{ contact: Contact }>(res);
      return data.contact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTACTS_KEY }),
    onError: () => qc.invalidateQueries({ queryKey: CONTACTS_KEY }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateContactPayload) => {
      const res = await fetch(`/api/contacts/${payload.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJson<{ contact: Contact }>(res);
      return data.contact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTACTS_KEY }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      await parseJson<{ ok: boolean }>(res);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTACTS_KEY }),
  });
}

// ─── Recurring schedules ─────────────────────────────────────────────────────

import type { RecurringRow } from "@/db/schema";

export type RecurringSchedule = RecurringRow;

const RECURRING_KEY = ["recurring"] as const;

export interface CreateRecurringPayload {
  id: string;
  recipientLabel?: string | null;
  recipientAddress: string;
  token?: string;
  tokenAddress?: string | null;
  amountHuman: string;
  amountBaseUnits: string;
  cadence: string;
  nextFireAt: number;
  maxExecutions: number;
  scheduleIdHash: string;
  anchorChainId?: number;
  anchorTxHash?: string | null;
  senderAddress: string;
  userId?: string | null;
}

export interface UpdateRecurringPayload {
  id: string;
  active?: boolean;
  executions?: number;
  lastFireAt?: number | null;
  nextFireAt?: number;
  anchorTxHash?: string | null;
}

export function useRecurringSchedules() {
  return useQuery({
    queryKey: RECURRING_KEY,
    queryFn: async () => {
      const res = await fetch("/api/recurring", { cache: "no-store" });
      const data = await parseJson<{ schedules: RecurringSchedule[] }>(res);
      return data.schedules;
    },
  });
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRecurringPayload) => {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJson<{ schedule: RecurringSchedule }>(res);
      return data.schedule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_KEY }),
  });
}

export function useUpdateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateRecurringPayload) => {
      const res = await fetch(`/api/recurring/${payload.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJson<{ schedule: RecurringSchedule }>(res);
      return data.schedule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_KEY }),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring/${id}`, { method: "DELETE" });
      await parseJson<{ ok: boolean }>(res);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_KEY }),
  });
}
