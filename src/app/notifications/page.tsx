"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import { Bell, BellOff, CheckCheck, Circle, AlertCircle, Shield, Info } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { StatCard, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { timeAgo, formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "payment" | "security" | "system";
  read: boolean;
  relatedPaymentId?: string | null;
  createdAt: number;
}

const typeConfig: Record<string, { icon: typeof Bell; className: string }> = {
  payment: { icon: Bell, className: "bg-primary/10 text-primary" },
  security: { icon: Shield, className: "bg-warning/10 text-warning" },
  system: { icon: Info, className: "bg-surface-3 text-muted" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const retry = useCallback(() => {
    startTransition(() => {
      setLoading(true);
      setFetchError(false);
    });
    setNotifications([]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/notifications", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) startTransition(() => setFetchError(true));
          return;
        }
        const data = await res.json() as { notifications: NotificationItem[] };
        if (!cancelled) startTransition(() => setNotifications(data.notifications));
      } catch {
        if (!cancelled) startTransition(() => setFetchError(true));
      } finally {
        if (!cancelled) startTransition(() => setLoading(false));
      }
    }

    load();
    const interval = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <PageContainer
      title="Notifications"
      description="Alerts and payment status updates"
      icon={<Bell className="h-5 w-5" />}
      action={
        unreadCount > 0 ? (
          <Button variant="secondary" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Unread" value={`${unreadCount}`} />
        <StatCard label="Total" value={`${notifications.length}`} />
        <StatCard
          label="Payment alerts"
          value={`${notifications.filter((n) => n.type === "payment").length}`}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          Loading notifications…
        </div>
      ) : fetchError ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Could not load notifications. The server may be unavailable.
          <button type="button" onClick={retry} className="ml-auto text-xs underline">Retry</button>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<BellOff className="h-6 w-6" />}
          title="No notifications"
          description="You're all caught up."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const config = typeConfig[notif.type] ?? typeConfig.system;
            const Icon = config.icon;

            return (
              <button
                key={notif.id}
                type="button"
                onClick={() => !notif.read && markRead(notif.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors cursor-pointer",
                  notif.read
                    ? "border-border bg-surface/50"
                    : "border-primary/20 bg-primary/5",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    config.className,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm", notif.read ? "text-muted" : "font-medium text-foreground")}>
                      {notif.title}
                    </p>
                    {!notif.read ? (
                      <Circle className="h-2 w-2 shrink-0 fill-primary text-primary" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{notif.message}</p>
                  <p
                    className="mt-1 text-[11px] text-muted-2"
                    title={formatFullDate(notif.createdAt)}
                  >
                    {timeAgo(notif.createdAt)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
