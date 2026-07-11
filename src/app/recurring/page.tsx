"use client";

import { useMemo, useState, useCallback, memo } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Plus,
  Loader2,
  Clock,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Trash2,
  Power,
  ShieldCheck,
  ChevronDown,
  Copy,
  Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PageContainer } from "@/components/page-container";
import { Card, StatCard, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRecurringSchedules, useDeleteRecurring } from "@/lib/api";
import { useRecurringSchedule } from "@/lib/use-recurring-schedule";
import { RECURRING_EXPLORERS } from "@/lib/anchors/recurring-config";
import { shortenAddress, timeAgo, timeUntil, formatFullDate } from "@/lib/format";
import { getUsdc, networkName, explorerAddressUrl } from "@/lib/wagmi/chains";
import { useChainId } from "wagmi";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const CADENCE_OPTIONS = [
  { value: 1 },
  { value: 2 },
  { value: 3 },
] as const;

function cadenceLabel(value: number, t: (k: TranslationKey) => string): string {
  return value === 1 ? t("recurring.weekly") : value === 2 ? t("recurring.biweekly") : t("recurring.monthly");
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-muted-2 shrink-0 text-xs">{label}</span>
      <span className="text-right text-xs">{children}</span>
    </div>
  );
}

function CopyableValue({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 font-mono text-xs text-muted transition-colors hover:text-foreground"
      title={label ? `${t("common.copy")} ${label}` : t("common.copy")}
    >
      {shortenAddress(value)}
      <Copy className={cn("h-3 w-3 transition-opacity", copied ? "opacity-100 text-success" : "opacity-40")} />
    </button>
  );
}

const ScheduleRow = memo(function ScheduleRow({
  schedule,
  isExpanded,
  onToggle,
  onCancel,
  isCancelling,
  cancelingId,
  onDelete,
  deletingId,
  now,
}: {
  schedule: RecurringScheduleDbType;
  isExpanded: boolean;
  onToggle: () => void;
  onCancel: (scheduleIdHash: string, dbId: string) => void;
  isCancelling: boolean;
  cancelingId: string | null;
  onDelete: (dbId: string) => void;
  deletingId: string | null;
  now: number;
}) {
  const { t } = useI18n();
  const chainId = schedule.anchorChainId ?? 177;
  const explorerBase = RECURRING_EXPLORERS[chainId] ?? "https://hashkey.blockscout.com";
  const cLabel = cadenceLabel(Number(schedule.cadence) === 1 || Number(schedule.cadence) === 2 || Number(schedule.cadence) === 3 ? Number(schedule.cadence) : 3, t);
  const progressPct = schedule.maxExecutions > 0 ? Math.min(100, (schedule.executions / schedule.maxExecutions) * 100) : 0;
  const isComplete = schedule.executions >= schedule.maxExecutions;
  const isOverdue = schedule.active && !isComplete && schedule.nextFireAt * 1000 < now;
  const paidAmount = parseFloat(schedule.amountHuman) * schedule.executions;
  const totalAmount = parseFloat(schedule.amountHuman) * schedule.maxExecutions;
  const remainingAmount = totalAmount - paidAmount;

  return (
    <motion.div className="rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="glass-item flex w-full items-center gap-3 p-4 text-left cursor-pointer transition-colors hover:bg-surface-2/50"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/20">
          {(schedule.recipientLabel ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {schedule.recipientLabel ?? t("recurring.unknownRecipient")}
            </p>
            {schedule.active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <Check className="h-3 w-3" /> {isComplete ? t("recurring.complete") : t("recurring.active")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/10 px-2 py-0.5 text-xs font-medium text-muted">
                <X className="h-3 w-3" /> {t("recurring.cancelled")}
              </span>
            )}
            {isOverdue ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                <AlertCircle className="h-3 w-3" /> {t("recurring.overdue")}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <CalendarClock className="h-2.5 w-2.5" /> {cLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="truncate font-mono text-xs text-muted">{shortenAddress(schedule.recipientAddress)}</p>
            <span className="text-[10px] text-muted-3">·</span>
            <span className="text-[10px] text-muted-2 shrink-0">{networkName(chainId)}</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2/60">
              <motion.div
                className={cn(
                  "h-full rounded-full transition-all",
                  isComplete ? "bg-success" : isOverdue ? "bg-danger" : "bg-primary",
                )}
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-2 tabular-nums shrink-0">
              {schedule.executions}/{schedule.maxExecutions}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-semibold text-foreground tabular-nums">
            {totalAmount.toFixed(2)}
          </p>
          <p className="text-xs text-muted-2">{schedule.token} {t("recurring.total")}</p>
          <p className="mt-0.5 text-[11px] text-muted-2">
            {schedule.active && !isComplete
              ? timeUntil(schedule.nextFireAt * 1000)
              : isComplete
                ? t("recurring.complete")
                : "—"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform duration-200",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            key="details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50 bg-surface-2/20 px-4 py-3">
              {/* Primary info grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <DetailRow label={t("recurring.status")}>
                  {schedule.active ? (
                    <span className="text-success">{isComplete ? t("recurring.complete") : t("recurring.active")}</span>
                  ) : (
                    <span className="text-muted">{t("recurring.cancelled")}</span>
                  )}
                </DetailRow>
                <DetailRow label={t("recurring.cadenceLabel")}>
                  <span className="text-muted">{cLabel}</span>
                </DetailRow>
                <DetailRow label={t("recurring.amountLabel")}>
                  <span className="font-mono text-muted">{schedule.amountHuman} {schedule.token}</span>
                </DetailRow>
                <DetailRow label={t("recurring.networkLabel")}>
                  <span className="font-mono text-muted">{networkName(chainId)}</span>
                </DetailRow>
                <DetailRow label={t("recurring.executionsLabel")}>
                  <span className="font-mono text-muted tabular-nums">
                    {schedule.executions} / {schedule.maxExecutions}
                  </span>
                </DetailRow>
                <DetailRow label={t("recurring.progressLabel")}>
                  <span className="font-mono text-muted tabular-nums">{progressPct.toFixed(0)}%</span>
                </DetailRow>
                <DetailRow label={t("recurring.nextPaymentLabel")}>
                  <span className={isOverdue ? "text-danger" : "text-muted"}>
                    {schedule.active && !isComplete
                      ? `${timeUntil(schedule.nextFireAt * 1000)} · ${formatFullDate(schedule.nextFireAt * 1000)}`
                      : "—"}
                  </span>
                </DetailRow>
                <DetailRow label={t("recurring.lastPaymentLabel")}>
                  <span className="text-muted">
                    {schedule.lastFireAt ? `${timeAgo(schedule.lastFireAt * 1000)} · ${formatFullDate(schedule.lastFireAt * 1000)}` : "—"}
                  </span>
                </DetailRow>
              </div>

              <div className="my-2 border-t border-border/40" />

              {/* Financial summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-surface-2/30 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-2">{t("recurring.paidSoFar")}</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-success tabular-nums">{paidAmount.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-3">{schedule.token}</p>
                </div>
                <div className="rounded-lg bg-surface-2/30 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-2">{t("recurring.remainingLabel")}</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-warning tabular-nums">{remainingAmount.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-3">{schedule.token}</p>
                </div>
                <div className="rounded-lg bg-surface-2/30 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-2">{t("recurring.total")}</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-foreground tabular-nums">{totalAmount.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-3">{schedule.token}</p>
                </div>
              </div>

              <div className="my-2 border-t border-border/40" />

              {/* On-chain details */}
              <div className="flex items-center gap-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                <Hash className="h-3 w-3" />
                {t("recurring.scheduleId")}
              </div>
              <DetailRow label={t("recurring.scheduleId")}>
                <div className="flex items-center gap-2">
                  <CopyableValue value={schedule.scheduleIdHash} label={t("recurring.scheduleId")} />
                </div>
              </DetailRow>

              <DetailRow label={t("recurring.recipientAddr")}>
                <div className="flex items-center gap-2">
                  <CopyableValue value={schedule.recipientAddress} label={t("recurring.recipientAddr")} />
                  <a
                    href={explorerAddressUrl(chainId, schedule.recipientAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary-hover"
                    title={t("common.viewExplorer")}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </DetailRow>

              {schedule.senderAddress ? (
                <DetailRow label={t("recurring.senderLabel")}>
                  <div className="flex items-center gap-2">
                    <CopyableValue value={schedule.senderAddress} label={t("recurring.senderLabel")} />
                    <a
                      href={explorerAddressUrl(chainId, schedule.senderAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary-hover"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </DetailRow>
              ) : null}

              <DetailRow label={t("recurring.tokenLabel")}>
                <span className="font-mono text-muted">{schedule.token}</span>
              </DetailRow>

              <DetailRow label={t("recurring.registeredAt")}>
                <span className="text-muted">{formatFullDate(schedule.createdAt)}</span>
              </DetailRow>

              {schedule.anchorTxHash ? (
                <DetailRow label={t("recurring.anchorTxHash")}>
                  <div className="flex items-center gap-2">
                    <CopyableValue value={schedule.anchorTxHash} label={t("recurring.anchorTxHash")} />
                    <a
                      href={`${explorerBase}/tx/${schedule.anchorTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline text-xs"
                    >
                      {t("common.viewTx")} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </DetailRow>
              ) : (
                <DetailRow label={t("recurring.anchorTxHash")}>
                  <span className="text-muted-2 italic">{t("recurring.noTxHash")}</span>
                </DetailRow>
              )}

              {/* Actions */}
              <div className="my-2 border-t border-border/40" />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {schedule.active && !isComplete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancel(schedule.scheduleIdHash, schedule.id);
                    }}
                    disabled={isCancelling && cancelingId === schedule.id}
                    className="h-7 gap-1.5 text-xs text-warning hover:text-warning"
                  >
                    {isCancelling && cancelingId === schedule.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Power className="h-3 w-3" />
                    )}
                    {t("recurring.cancelBtn")}
                  </Button>
                ) : null}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(schedule.id);
                  }}
                  disabled={deletingId === schedule.id}
                  className="h-7 gap-1.5 text-xs text-danger hover:text-danger"
                >
                  {deletingId === schedule.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  {t("recurring.delete")}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
});

interface RecurringScheduleDbType {
  id: string;
  recipientLabel: string | null;
  recipientAddress: string;
  token: string;
  tokenAddress: string | null;
  amountHuman: string;
  amountBaseUnits: string;
  cadence: string;
  nextFireAt: number;
  lastFireAt: number | null;
  executions: number;
  maxExecutions: number;
  active: boolean;
  scheduleIdHash: string;
  anchorChainId: number;
  anchorTxHash: string | null;
  senderAddress: string | null;
  createdAt: number;
  userId: string | null;
}

export default function RecurringPage() {
  const { t } = useI18n();
  const chainId = useChainId();
  const { data: schedules, isLoading, isFetching, refetch } = useRecurringSchedules();
  const { register, cancel, isRegistering, isCancelling, canRegister } = useRecurringSchedule();
  const deleteRecurring = useDeleteRecurring();

  const [showCreate, setShowCreate] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [amountHuman, setAmountHuman] = useState("");
  const [cadence, setCadence] = useState<number>(3);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  });
  const [maxExecutions, setMaxExecutions] = useState(12);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const rows = useMemo<RecurringScheduleDbType[]>(() => schedules ?? [], [schedules]);
  const activeRows = useMemo(() => rows.filter((s) => s.active), [rows]);

  const stats = useMemo(() => {
    const activeCount = activeRows.length;
    const totalScheduled = activeRows.reduce((sum, s) => {
      const n = parseFloat(s.amountHuman);
      return Number.isFinite(n) ? sum + n * s.maxExecutions : sum;
    }, 0);
    const nextFire = activeRows.length > 0
      ? Math.min(...activeRows.map((s) => s.nextFireAt))
      : null;
    const completedExecutions = rows.reduce((sum, s) => sum + s.executions, 0);
    const totalPaid = rows.reduce((sum, s) => {
      const n = parseFloat(s.amountHuman);
      return Number.isFinite(n) ? sum + n * s.executions : sum;
    }, 0);
    return { activeCount, totalScheduled, nextFire, completedExecutions, totalPaid };
  }, [rows, activeRows]);

  const handleRegister = useCallback(async () => {
    setFormError(null);
    if (!recipientAddress || recipientAddress.length !== 42) {
      setFormError(t("recurring.recipient"));
      return;
    }
    const amount = parseFloat(amountHuman);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError(t("recurring.amount"));
      return;
    }
    if (!cadence || cadence < 1 || cadence > 3) {
      setFormError(t("recurring.cadence"));
      return;
    }
    const firstFireAt = Math.floor(new Date(startDate).getTime() / 1000);
    if (!firstFireAt || firstFireAt < Math.floor(Date.now() / 1000)) {
      setFormError(t("recurring.startDate"));
      return;
    }
    if (maxExecutions < 1 || maxExecutions > 365) {
      setFormError(t("recurring.maxExecutions"));
      return;
    }

    const cfg = getUsdc(chainId ?? 133);
    const tokenAddress = cfg?.address ?? "";
    const amountBaseUnits = (BigInt(Math.floor(amount * 1e6))).toString();

    const result = await register({
      recipientAddress,
      tokenAddress,
      amountBaseUnits,
      amountHuman: amount.toFixed(6),
      cadence,
      firstFireAt,
      maxExecutions,
      recipientLabel: recipientLabel || null,
      token: cfg?.symbol ?? "USDC",
    });

    if (result.status === "registered") {
      setShowCreate(false);
      setRecipientAddress("");
      setRecipientLabel("");
      setAmountHuman("");
      refetch();
    } else if (result.status === "failed") {
      setFormError(result.error);
    } else if (result.status === "declined") {
      setFormError(result.reason);
    }
  }, [recipientAddress, recipientLabel, amountHuman, cadence, startDate, maxExecutions, register, refetch, t, chainId]);

  const handleCancel = useCallback(
    async (scheduleIdHash: string, dbId: string) => {
      setCancelingId(dbId);
      const result = await cancel(scheduleIdHash, dbId);
      setCancelingId(null);
      if (result.status === "cancelled") {
        refetch();
      }
    },
    [cancel, refetch],
  );

  const handleDelete = useCallback(
    async (dbId: string) => {
      if (!confirm(t("recurring.deleteConfirm"))) return;
      setDeletingId(dbId);
      try {
        await deleteRecurring.mutateAsync(dbId);
        if (expandedId === dbId) setExpandedId(null);
      } catch {
        // non-critical
      }
      setDeletingId(null);
    },
    [deleteRecurring, t, expandedId],
  );

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <PageContainer
      title={t("recurring.title")}
      description={t("recurring.desc")}
      icon={<CalendarClock className="h-5 w-5" />}
      action={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {t("recurring.refresh")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreate((v) => !v)}
            disabled={!canRegister}
          >
            {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showCreate ? t("recurring.cancelBtn") : t("recurring.newSchedule")}
          </Button>
        </div>
      }
    >
      {!canRegister ? (
        <Card>
          <div className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{t("recurring.notConfigured")}</p>
              <p className="text-xs text-muted-2 leading-relaxed">
                {t("recurring.notConfiguredDesc")}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t("recurring.activeSchedules")}
          value={`${stats.activeCount}`}
          sublabel={t("recurring.cancelledCount", { count: rows.length - stats.activeCount })}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard
          label={t("recurring.totalScheduled")}
          value={`${stats.totalScheduled.toFixed(2)}`}
          sublabel={t("recurring.usdcAcross")}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label={t("recurring.nextFireStat")}
          value={stats.nextFire ? timeUntil(stats.nextFire * 1000) : "—"}
          sublabel={stats.nextFire ? formatFullDate(stats.nextFire * 1000) : t("recurring.noActiveSchedules")}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label={t("recurring.totalPaid")}
          value={`${stats.totalPaid.toFixed(2)}`}
          sublabel={`${stats.completedExecutions} ${t("recurring.completedPayments")}`}
          icon={<Check className="h-4 w-4" />}
        />
      </div>

      <AnimatePresence>
        {showCreate ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <Card>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t("recurring.createTitle")}</h3>
                <p className="text-[11px] text-muted-2 leading-relaxed">
                  {t("recurring.createDesc")}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-2 mb-1 block">{t("recurring.recipient")}</label>
                    <input
                      type="text"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full rounded-lg bg-surface-2/50 border border-border/50 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-2 mb-1 block">{t("recurring.recipientLabel")}</label>
                    <input
                      type="text"
                      value={recipientLabel}
                      onChange={(e) => setRecipientLabel(e.target.value)}
                      placeholder={t("recurring.recipientLabelPlaceholder")}
                      className="w-full rounded-lg bg-surface-2/50 border border-border/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-2 mb-1 block">{t("recurring.amount")}</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={amountHuman}
                      onChange={(e) => setAmountHuman(e.target.value)}
                      placeholder="100.00"
                      className="w-full rounded-lg bg-surface-2/50 border border-border/50 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-2 mb-1 block">{t("recurring.cadence")}</label>
                    <select
                      value={cadence}
                      onChange={(e) => setCadence(Number(e.target.value))}
                      className="w-full rounded-lg bg-surface-2/50 border border-border/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {CADENCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {cadenceLabel(opt.value, t)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-2 mb-1 block">{t("recurring.startDate")}</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg bg-surface-2/50 border border-border/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-2 mb-1 block">{t("recurring.maxExecutions")}</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={maxExecutions}
                      onChange={(e) => setMaxExecutions(Number(e.target.value))}
                      className="w-full rounded-lg bg-surface-2/50 border border-border/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {formError ? (
                  <div className="flex items-center gap-2 text-xs text-danger">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formError}
                  </div>
                ) : null}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRegister}
                    disabled={isRegistering || !canRegister}
                  >
                    {isRegistering ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {isRegistering ? t("recurring.registering") : t("recurring.register")}
                  </Button>
                  <span className="text-[10px] text-muted-3">
                    {t("recurring.walletSwitch")}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("recurring.loading")}
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title={t("recurring.noSchedules")}
          description={t("recurring.noSchedulesDesc")}
          action={
            canRegister ? (
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5" />
                {t("recurring.newSchedule")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <ScheduleRow
              key={s.id}
              schedule={s}
              isExpanded={expandedId === s.id}
              onToggle={() => handleToggleExpand(s.id)}
              onCancel={handleCancel}
              isCancelling={isCancelling}
              cancelingId={cancelingId}
              onDelete={handleDelete}
              deletingId={deletingId}
              now={now}
            />
          ))}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Link href="/">
          <Button variant="ghost" size="sm">
            {t("payments.newViaChat")}
          </Button>
        </Link>
      </div>
    </PageContainer>
  );
}
