"use client";

import { useMemo, useState, useCallback, memo, useDeferredValue } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Star,
  Plus,
  Send,
  Trash2,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import { isAddress } from "viem";
import { PageContainer } from "@/components/page-container";
import { Card, StatCard, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useContacts,
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
  type Contact,
} from "@/lib/api";
import { shortenAddress, timeAgo } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const LOAD_TIME = Date.now();

const ContactCard = memo(function ContactCard({ contact }: { contact: Contact }) {
  const { t } = useI18n();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const initials = contact.label
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() =>
            updateContact.mutate({ id: contact.id, favorite: !contact.favorite })
          }
          disabled={updateContact.isPending}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/20"
          aria-label={contact.favorite ? t("contacts.unfavorite") : t("contacts.favorite")}
        >
          {initials}
          {contact.favorite ? (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-warning text-white">
              <Star className="h-3 w-3 fill-white" />
            </span>
          ) : null}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{contact.label}</p>
          <p className="truncate font-mono text-xs text-muted">
            {shortenAddress(contact.address)}
          </p>
        </div>
      </div>
      {contact.note ? <p className="text-xs text-muted-2">{contact.note}</p> : null}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-2">{t("contacts.lastUsed")} {timeAgo(contact.lastUsed)}</span>
        <div className="flex gap-1">
          <Link href="/">
            <Button variant="ghost" size="sm" className="h-8 px-2">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted hover:text-danger"
            onClick={() => deleteContact.mutate(contact.id)}
            disabled={deleteContact.isPending}
            aria-label={t("contacts.deleteContact")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});

export default function ContactsPage() {
  const { t } = useI18n();
  const { data: contacts, isLoading } = useContacts();
  const createContact = useCreateContact();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ label: "", address: "", note: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const rows = useMemo(() => contacts ?? [], [contacts]);

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      if (showFavoritesOnly && !c.favorite) return false;
      if (!deferredQuery) return true;
      const q = deferredQuery.toLowerCase();
      return (
        c.label.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, deferredQuery, showFavoritesOnly]);

  const stats = useMemo(() => {
    const favoritesCount = rows.filter((c) => c.favorite).length;
    const recentlyUsedCount = rows.filter((c) => LOAD_TIME - c.lastUsed < DAY_MS).length;
    return { favoritesCount, recentlyUsedCount };
  }, [rows]);

  const resetForm = useCallback(() => {
    setForm({ label: "", address: "", note: "" });
    setFormError(null);
  }, []);

  const handleAdd = useCallback(async () => {
    setFormError(null);
    if (!form.label.trim()) {
      setFormError(t("contacts.errorNameRequired"));
      return;
    }
    if (!isAddress(form.address.trim())) {
      setFormError(t("contacts.errorAddressRequired"));
      return;
    }
    try {
      await createContact.mutateAsync({
        label: form.label.trim(),
        address: form.address.trim(),
        note: form.note.trim(),
      });
      resetForm();
      setShowAddForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("contacts.errorFailed"));
    }
  }, [form, createContact, resetForm, t]);

  const handleToggleFavorites = useCallback(
    () => setShowFavoritesOnly((v) => !v),
    [],
  );

  return (
    <PageContainer
      title={t("contacts.title")}
      description={t("contacts.desc")}
      icon={<Users className="h-5 w-5" />}
      action={
        <Button variant="primary" size="sm" onClick={() => setShowAddForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          {t("contacts.addContact")}
        </Button>
      }
    >
      {showAddForm ? (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{t("contacts.newContact")}</h2>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
              aria-label={t("contacts.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted">{t("contacts.name")}</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={t("contacts.namePlaceholder")}
                className="mt-1 w-full rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-2 focus:border-primary/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted">{t("contacts.address")}</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="0x…"
                spellCheck={false}
                className="mt-1 w-full rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-2 focus:border-primary/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted">{t("contacts.noteOptional")}</label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder={t("contacts.notePlaceholder")}
                className="mt-1 w-full rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-2 focus:border-primary/40 focus:outline-none"
              />
            </div>

            {formError ? (
              <p className="flex items-center gap-2 text-xs text-danger">
                <AlertCircle className="h-3.5 w-3.5" />
                {formError}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
              >
                {t("contacts.cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAdd}
                disabled={createContact.isPending}
              >
                {createContact.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {t("contacts.saveContact")}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={t("contacts.totalContacts")} value={`${rows.length}`} />
        <StatCard label={t("contacts.favorites")} value={`${stats.favoritesCount}`} />
        <StatCard
          label={t("contacts.recentlyUsed")}
          value={`${stats.recentlyUsedCount}`}
          sublabel={t("contacts.recentlyUsedDesc")}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-3">
            <Search className="h-4 w-4 text-muted-2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("contacts.searchPlaceholder")}
              className="flex-1 bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-2 focus:outline-none"
            />
          </div>
          <Button
            variant={showFavoritesOnly ? "primary" : "secondary"}
            size="sm"
            onClick={handleToggleFavorites}
          >
            <Star className={cn("h-3.5 w-3.5", showFavoritesOnly && "fill-current")} />
            {t("contacts.favorites")}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("contacts.loading")}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={rows.length === 0 ? t("contacts.noContacts") : t("contacts.noContactsFound")}
          description={
            rows.length === 0
              ? t("contacts.noContactsDesc")
              : t("contacts.noContactsFoundDesc")
          }
          action={
            <Button variant="primary" size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4" />
              {t("contacts.addContact")}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
