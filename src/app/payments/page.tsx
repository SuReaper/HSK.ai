"use client";

import { useMemo, useState, memo, useCallback, useDeferredValue, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Receipt,
  Filter,
  Check,
  X,
  Loader2,
  Clock,
  ArrowUpDown,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  Anchor,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Copy,
  Wallet,
  Send,
  Trash2,
  RefreshCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PageContainer } from "@/components/page-container";
import { Card, StatCard, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePayments, useSyncPayment, useDeletePayment } from "@/lib/api";
import { useAnchorIntent } from "@/lib/use-anchor-intent";
import { shortenAddress, timeAgo, formatFullDate } from "@/lib/format";
import { explorerTxUrl, explorerAddressUrl, networkName, getUsdc } from "@/lib/wagmi/chains";
import { firePaymentConfetti } from "@/lib/confetti";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | "settled" | "pending" | "failed" | "anchored";

const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: "All", value: "all" },
  { label: "Settled", value: "settled" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
  { label: "Anchored", value: "anchored" },
];

function isPendingStatus(status: string) {
  return (
    status === "pending" ||
    status === "signing" ||
    status === "settling" ||
    status === "sent" ||
    status === "approving" ||
    status === "deploying"
  );
}

/**
 * Whether the HSP coordinator state might have progressed further than what the
 * DB currently records. Used to decide whether to show the "Sync HSP" button
 * and whether to auto-sync on page load.
 */
function isHspStale(p: { hspPaymentId?: string | null; hspStatus?: string | null }): boolean {
  if (!p.hspPaymentId) return false;
  const TERMINAL = new Set(["SETTLED", "FAILED", "DISPUTED", "EXPIRED"]);
  if (p.hspStatus && TERMINAL.has(p.hspStatus)) return false;
  return true;
}

interface StatusEntry {
  label: string;
  icon: typeof Check;
  className: string;
  spin?: boolean;
  pulse?: boolean;
}

const ALL_STATUSES: Record<string, StatusEntry> = {
  settled: { label: "Settled", icon: Check, className: "bg-success/10 text-success" },
  failed: { label: "Failed", icon: X, className: "bg-danger/10 text-danger" },
  pending: { label: "Pending", icon: Clock, className: "bg-warning/10 text-warning", pulse: true },
  signing: { label: "Signing", icon: Loader2, className: "bg-primary/10 text-primary", spin: true },
  settling: { label: "Settling", icon: Loader2, className: "bg-primary/10 text-primary", spin: true },
  approving: { label: "Approving", icon: Loader2, className: "bg-warning/10 text-warning", spin: true },
  deploying: { label: "Deploying", icon: Loader2, className: "bg-warning/10 text-warning", spin: true },
  sent: {
    label: "On-chain (HSP verifying)",
    icon: ShieldCheck,
    className: "bg-primary/10 text-primary",
    pulse: true,
  },
  sent_verified: {
    label: "Verified (HSP)",
    icon: ShieldCheck,
    className: "bg-success/10 text-success",
  },
};

function getStatusEntry(status: string, hspVerified?: boolean | null): StatusEntry {
  if (status === "sent" && hspVerified === true) return ALL_STATUSES.sent_verified;
  return ALL_STATUSES[status] ?? {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    icon: Clock,
    className: "bg-warning/10 text-warning",
  };
}

const StatusBadge = memo(function StatusBadge({
  status,
  hspVerified,
}: {
  status: string;
  hspVerified?: boolean | null;
}) {
  const { t } = useI18n();
  const c = getStatusEntry(status, hspVerified);
  const Icon = c.icon;
  const labelMap: Record<string, TranslationKey> = {
    settled: "payments.statusSettled",
    failed: "payments.statusFailed",
    pending: "payments.statusPending",
    signing: "payments.statusSigning",
    settling: "payments.statusSettled",
    approving: "payments.statusSigning",
    deploying: "payments.statusSigning",
    sent: "payments.statusSent",
    sent_verified: "payments.statusSentVerified",
  };
  const tKey = labelMap[status === "sent" && hspVerified === true ? "sent_verified" : status] ;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        c.className,
      )}
    >
      <Icon className={cn("h-3 w-3", c.spin && "animate-spin", c.pulse && "animate-pulse")} />
      {tKey ? t(tKey) : c.label}
    </span>
  );
});

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
      className={cn(
        "flex items-center gap-1 font-mono text-xs text-muted transition-colors hover:text-foreground",
      )}
      title={label ? `${t("common.copy")} ${label}` : t("common.copy")}
    >
      {shortenAddress(value)}
      <Copy className={cn("h-3 w-3 transition-opacity", copied ? "opacity-100 text-success" : "opacity-40")} />
    </button>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-muted-2 shrink-0 text-xs">{label}</span>
      <span className="text-right text-xs">{children}</span>
    </div>
  );
}

interface PaymentDbType {
  id: string;
  recipientLabel: string | null;
  recipientAddress: string;
  token: string;
  tokenAddress: string | null;
  amountHuman: string;
  amountBaseUnits: string;
  status: string;
  memo: string | null;
  txHash: string | null;
  chainId: number;
  senderAddress: string | null;
  createdAt: number;
  settledAt: number | null;
  hspPaymentId: string | null;
  hspStatus: string | null;
  hspVerified: boolean | null;
  hspDecision: string | null;
  hspSettledAt: number | null;
  anchorIntentHash: string | null;
  anchorChainId: number | null;
  anchorHspPaymentId: string | null;
  anchorTxHash: string | null;
  anchoredAt: number | null;
}

const PaymentRow = memo(function PaymentRow({
  payment,
  isExpanded,
  onToggle,
  onAnchor,
  isAnchoring,
  anchorError,
  onSync,
  isSyncing,
  syncError,
  onDelete,
  isDeleting,
  deleteError,
}: {
  payment: PaymentDbType;
  isExpanded: boolean;
  onToggle: () => void;
  onAnchor?: (paymentId: string) => void;
  isAnchoring?: boolean;
  anchorError?: string | null;
  onSync?: (paymentId: string) => void;
  isSyncing?: boolean;
  syncError?: string | null;
  onDelete?: (paymentId: string) => void;
  isDeleting?: boolean;
  deleteError?: string | null;
}) {
  const { t } = useI18n();
  const chainId = payment.chainId;
  const hasTx = !!payment.txHash && payment.txHash !== "0x0" && payment.txHash !== "";
  const tokenInfo = getUsdc(chainId);
  const tokenContract =
    payment.tokenAddress ?? (tokenInfo?.address ?? null);
  const isHsp = !!payment.hspPaymentId;
  const anchorConfigured = !!onAnchor;
  const isAnchored = !!payment.anchorTxHash;
  const anchorChain = payment.anchorChainId ?? 177;

  return (
    <motion.div className="rounded-2xl overflow-hidden">
      {/* Compact header row */}
      <button
        type="button"
        onClick={onToggle}
        className="glass-item flex w-full items-center gap-3 p-4 text-left cursor-pointer transition-colors hover:bg-surface-2/50"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/20">
          {(payment.recipientLabel ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {payment.recipientLabel ?? t("recurring.unknownRecipient")}
            </p>
            <StatusBadge status={payment.status} hspVerified={payment.hspVerified} />
            {isHsp ? (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary" title={t("payments.hspVerifiable")}>
                <ShieldCheck className="h-2.5 w-2.5" /> HSP
              </span>
            ) : null}
            {isAnchored ? (
              <span className="flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success" title={t("payments.anchoredOnMainnet")}>
                <Anchor className="h-2.5 w-2.5" /> {t("payments.anchored")}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="truncate font-mono text-xs text-muted">
              {shortenAddress(payment.recipientAddress)}
            </p>
            <span className="text-[10px] text-muted-3">·</span>
            <span className="text-[10px] text-muted-2 shrink-0">{networkName(chainId)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-semibold text-foreground tabular-nums">
            {payment.amountHuman}
          </p>
          <p className="text-xs text-muted-2">{payment.token}</p>
          <p className="mt-0.5 text-[11px] text-muted-2" title={formatFullDate(payment.createdAt)}>
            {timeAgo(payment.createdAt)}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform duration-200",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded details panel */}
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
                <DetailRow label={t("payments.status")}>
                  <StatusBadge status={payment.status} hspVerified={payment.hspVerified} />
                </DetailRow>
                <DetailRow label={t("payments.network")}>
                  <span className="font-mono text-muted">{networkName(chainId)}</span>
                </DetailRow>
                <DetailRow label={t("payments.token")}>
                  <span className="font-mono text-muted">{payment.token}</span>
                </DetailRow>
                <DetailRow label={t("payments.amount")}>
                  <span className="font-mono text-muted tabular-nums">
                    {Number(BigInt(payment.amountBaseUnits)).toLocaleString()}
                  </span>
                </DetailRow>
                <DetailRow label={t("payments.created")}>
                  <span className="text-muted">{formatFullDate(payment.createdAt)}</span>
                </DetailRow>
                {payment.settledAt ? (
                  <DetailRow label={t("payments.settledTime")}>
                    <span className="text-success">{formatFullDate(payment.settledAt)}</span>
                  </DetailRow>
                ) : null}
              </div>

              <div className="my-2 border-t border-border/40" />

              {/* Recipient */}
              <DetailRow label={t("payments.recipient")}>
                <div className="flex items-center gap-2">
                  <CopyableValue value={payment.recipientAddress} label={t("payments.recipient")} />
                  <a
                    href={explorerAddressUrl(chainId, payment.recipientAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary-hover"
                    title={t("common.viewExplorer")}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </DetailRow>

              {/* Sender */}
              {payment.senderAddress ? (
                <DetailRow label={t("payments.sender")}>
                  <div className="flex items-center gap-2">
                    <CopyableValue value={payment.senderAddress} label={t("payments.sender")} />
                    <a
                      href={explorerAddressUrl(chainId, payment.senderAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary-hover"
                      title={t("common.viewExplorer")}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </DetailRow>
              ) : null}

              {/* Token contract */}
              {tokenContract ? (
                <DetailRow label={t("payments.tokenContract")}>
                  <div className="flex items-center gap-2">
                    <CopyableValue value={tokenContract} label={t("payments.tokenContract")} />
                    <a
                      href={explorerAddressUrl(chainId, tokenContract)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary-hover"
                      title={t("common.viewExplorer")}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </DetailRow>
              ) : (
                <DetailRow label={t("payments.tokenContract")}>
                  <span className="text-muted-2 italic">{t("payments.native")}</span>
                </DetailRow>
              )}

              {/* Tx hash */}
              {hasTx ? (
                <DetailRow label={t("payments.txHash")}>
                  <div className="flex items-center gap-2">
                    <CopyableValue value={payment.txHash!} label={t("common.viewTx")} />
                    <a
                      href={explorerTxUrl(chainId, payment.txHash!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline text-xs"
                    >
                      {t("common.viewTx")} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </DetailRow>
              ) : (
                <DetailRow label={t("payments.txHash")}>
                  <span className="text-muted-2 italic">{t("payments.notBroadcast")}</span>
                </DetailRow>
              )}

              {/* Memo */}
              {payment.memo ? (
                <DetailRow label={t("payments.memo")}>
                  <span className="text-foreground max-w-[60ch]">{payment.memo}</span>
                </DetailRow>
              ) : null}

              {/* HSP settlement section */}
              {isHsp ? (
                <>
                  <div className="my-2 border-t border-border/40" />
                  <div className="flex items-center gap-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    <ShieldCheck className="h-3 w-3" />
                    {t("payments.hspSection")}
                  </div>

                  <DetailRow label={t("payments.hspStatus")}>
                    <span
                      className={cn(
                        "font-mono text-xs",
                        payment.hspStatus === "SETTLED" && payment.hspVerified
                          ? "text-success"
                          : payment.hspStatus === "PENDING" || payment.hspStatus === "PROPOSED"
                            ? "text-warning"
                            : payment.hspStatus === "FAILED"
                              ? "text-danger"
                              : "text-muted",
                      )}
                    >
                      {payment.hspStatus ?? t("payments.hspStatusUnknown")}
                    </span>
                  </DetailRow>

                  {payment.hspVerified === true ? (
                    <div className="flex items-center gap-2 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      <span className="text-xs text-success font-medium">
                        {t("payments.hspVerified")}
                      </span>
                    </div>
                  ) : payment.hspDecision === "REJECT" ? (
                    <div className="flex items-center gap-2 py-1">
                      <AlertCircle className="h-3.5 w-3.5 text-danger" />
                      <span className="text-xs text-danger">
                        {t("payments.hspRejected")}
                      </span>
                    </div>
                  ) : isPendingStatus(payment.hspStatus ?? "") ? (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span className="text-xs text-primary">
                        {t("payments.hspObserving")}
                      </span>
                    </div>
                  ) : null}

                  <DetailRow label={t("payments.hspPaymentId")}>
                    <div className="flex items-center gap-2">
                      <CopyableValue value={payment.hspPaymentId!} label={t("payments.hspPaymentId")} />
                      <a
                        href={`https://hsp-hackathon.hashkeymerchant.com/explorer?id=${payment.hspPaymentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        {t("payments.hspExplorer")} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </DetailRow>

                  {payment.hspSettledAt ? (
                    <DetailRow label={t("payments.hspSettledAt")}>
                      <span className="text-success">{formatFullDate(payment.hspSettledAt)}</span>
                    </DetailRow>
                  ) : null}
                </>
              ) : payment.token !== "HSK" && payment.token !== "ETH" ? (
                <>
                  <div className="my-2 border-t border-border/40" />
                  <div className="flex items-center gap-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-2">
                    <Send className="h-3 w-3" />
                    {t("payments.plainErc20Transfer")}
                  </div>
                  <p className="text-[11px] text-muted-2 leading-relaxed">
                    {t("payments.plainTransferDesc")}
                  </p>
                </>
              ) : null}

              {/* Anchor section — only for settled payments */}
              {payment.status === "settled" || payment.status === "sent" ? (
                <>
                  <div className="my-2 border-t border-border/40" />
                  <div className="flex items-center gap-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    <Anchor className="h-3 w-3" />
                    {t("payments.anchorSection")}
                  </div>

                  {isAnchored ? (
                    <>
                      <div className="flex items-center gap-2 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        <span className="text-xs text-success font-medium">
                          {payment.anchorTxHash ? t("payments.anchoredOnMainnet") : t("payments.alreadyAnchored")}
                        </span>
                      </div>
                      {payment.anchorTxHash ? (
                        <DetailRow label={t("payments.anchorTxHash")}>
                          <div className="flex items-center gap-2">
                            <CopyableValue
                              value={payment.anchorTxHash}
                              label={t("payments.anchorTxHash")}
                            />
                            <a
                              href={explorerTxUrl(anchorChain, payment.anchorTxHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline text-xs"
                            >
                              {t("common.viewExplorer")} {networkName(anchorChain)} <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </DetailRow>
                      ) : null}
                      {payment.anchorIntentHash ? (
                        <DetailRow label={t("payments.intentHash")}>
                          <CopyableValue
                            value={payment.anchorIntentHash}
                            label={t("payments.intentHash")}
                          />
                        </DetailRow>
                      ) : null}
                      {payment.anchoredAt ? (
                        <DetailRow label={t("payments.anchoredAt")}>
                          <span className="text-muted">{formatFullDate(payment.anchoredAt)}</span>
                        </DetailRow>
                      ) : null}
                    </>
                  ) : anchorConfigured ? (
                    <div className="py-1.5 space-y-2">
                      {isAnchoring ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          <span className="text-xs text-primary">
                            {t("payments.anchoring")}
                          </span>
                          {chainId !== 177 ? (
                            <span className="text-[10px] text-muted-3">
                              {t("payments.anchorSwitchNote")}
                            </span>
                          ) : null}
                        </div>
                      ) : anchorError ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-3.5 w-3.5 text-danger shrink-0" />
                            <span className="text-xs text-danger">{anchorError}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAnchor?.(payment.id)}
                            className="h-7 w-fit px-2 text-xs"
                          >
                            {t("payments.retryAnchor", { retry: t("chat.retry") })}
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[11px] text-muted-2 mb-2 leading-relaxed">
                            {t("payments.anchorDesc")}
                            {chainId !== 177 ? (
                              <>
                                {" "}
                                {t("payments.anchorSwitchNote")}
                              </>
                            ) : null}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAnchor?.(payment.id)}
                            className="h-7 gap-1.5 text-xs"
                          >
                            <Anchor className="h-3 w-3" />
                            {t("payments.anchorOnMainnet")}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-2 italic py-1">
                      {t("payments.anchorNotConfigured")}
                    </p>
                  )}
                </>
              ) : null}

              {/* Sync + Delete actions */}
              <div className="my-2 border-t border-border/40" />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {isHsp ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSync?.(payment.id);
                    }}
                    disabled={isSyncing}
                    className="h-7 gap-1.5 text-xs"
                    title={t("payments.syncHsp")}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-3 w-3" />
                    )}
                    {isSyncing ? t("payments.syncing") : t("payments.syncHsp")}
                  </Button>
                ) : null}
                {syncError ? (
                  <span className="text-[10px] text-danger flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {syncError}
                  </span>
                ) : null}

                <div className="flex-1" />

                {isDeleting ? (
                  <span className="text-xs text-muted flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("payments.deleting")}
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm(
                          t("payments.deleteConfirmName", { name: payment.recipientLabel ?? payment.recipientAddress }),
                        )
                      ) {
                        onDelete?.(payment.id);
                      }
                    }}
                    disabled={isDeleting}
                    className="h-7 gap-1.5 text-xs text-danger hover:text-danger"
                    title={t("payments.delete")}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t("payments.delete")}
                  </Button>
                )}
                {deleteError ? (
                  <span className="text-[10px] text-danger flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {deleteError}
                  </span>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
});

export default function PaymentsPage() {
  const { t } = useI18n();
  const { data: payments, isLoading, isFetching, refetch } = usePayments();
  const { anchor, canAnchor } = useAnchorIntent();
  const syncPayment = useSyncPayment();
  const deletePayment = useDeletePayment();
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<"recent" | "amount">("recent");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [anchoringPaymentId, setAnchoringPaymentId] = useState<string | null>(null);
  const [anchorErrors, setAnchorErrors] = useState<Record<string, string>>({});
  const [syncingPaymentId, setSyncingPaymentId] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const autoSyncedRef = useRef(false);
  const deferredFilter = useDeferredValue(filter);
  const deferredSort = useDeferredValue(sortBy);

  const rows = useMemo<PaymentDbType[]>(() => payments ?? [], [payments]);

  // Auto-sync all stale HSP payments once on initial load.
  // This fixes the case where the on-chain settle succeeded but the HSP
  // observe timed out (DB says "sent" / "PENDING") and the coordinator has
  // since reached a terminal state asynchronously.
  useEffect(() => {
    if (autoSyncedRef.current) return;
    if (rows.length === 0) return;
    autoSyncedRef.current = true;
    const staleIds = rows.filter(isHspStale).map((p) => p.id);
    if (staleIds.length === 0) return;
    // fire all syncs in parallel
    staleIds.forEach((id) => {
      fetch(`/api/payments/${id}/sync`, { method: "POST" }).catch(() => {});
    });
    // refetch after a short delay to pick up the result
    setTimeout(() => refetch(), 2500);
  }, [rows, refetch]);

  const sorted = useMemo(() => {
    const list = rows.filter((p) => {
      if (deferredFilter === "all") return true;
      if (deferredFilter === "anchored") return !!p.anchorTxHash;
      if (deferredFilter === "pending") return isPendingStatus(p.status);
      return p.status === deferredFilter;
    });
    return [...list].sort((a, b) => {
      if (deferredSort === "amount")
        return parseFloat(b.amountHuman) - parseFloat(a.amountHuman);
      return b.createdAt - a.createdAt;
    });
  }, [rows, deferredFilter, deferredSort]);

  const stats = useMemo(() => {
    const settledRows = rows.filter((p) => p.status === "settled");
    const totalSent = settledRows.reduce(
      (sum, p) => {
        const n = parseFloat(p.amountHuman);
        return Number.isFinite(n) ? sum + n : sum;
      },
      0,
    );
    const successCount = settledRows.length;
    const pendingCount = rows.filter((p) => isPendingStatus(p.status)).length;
    const failedCount = rows.filter((p) => p.status === "failed").length;
    const anchoredCount = rows.filter((p) => !!p.anchorTxHash).length;
    const hspVerifiedCount = rows.filter((p) => p.hspVerified === true).length;
    const successRate = rows.length > 0 ? Math.round((successCount / rows.length) * 100) : 0;
    return {
      totalSent,
      successCount,
      pendingCount,
      failedCount,
      anchoredCount,
      hspVerifiedCount,
      successRate,
      totalCount: rows.length,
    };
  }, [rows]);

  const handleRefresh = useCallback(() => refetch(), [refetch]);
  const handleToggleSort = useCallback(
    () => setSortBy((s) => (s === "recent" ? "amount" : "recent")),
    [],
  );
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleAnchorPayment = useCallback(
    async (paymentId: string) => {
      setAnchoringPaymentId(paymentId);
      setAnchorErrors((prev) => {
        const next = { ...prev };
        delete next[paymentId];
        return next;
      });

      try {
        const result = await anchor(paymentId);

        if (result.status === "anchored") {
          refetch();
        } else if (result.status === "failed") {
          const errMsg = result.error?.includes("not found")
            ? t("payments.anchorNotFound")
            : result.error;
          setAnchorErrors((prev) => ({ ...prev, [paymentId]: errMsg }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Anchor failed.";
        setAnchorErrors((prev) => ({ ...prev, [paymentId]: msg }));
      } finally {
        setAnchoringPaymentId(null);
      }
    },
    [anchor, refetch, t],
  );

  const handleSyncPayment = useCallback(
    async (paymentId: string) => {
      setSyncingPaymentId(paymentId);
      setSyncErrors((prev) => {
        const next = { ...prev };
        delete next[paymentId];
        return next;
      });
      try {
        const result = await syncPayment.mutateAsync(paymentId);
        if (result.synced && result.hspStatus === "SETTLED" && result.hspVerified === true) {
          firePaymentConfetti();
        }
        if (!result.synced && result.reason !== "already terminal") {
          setSyncErrors((prev) => ({ ...prev, [paymentId]: result.reason ?? t("payments.syncNoUpdate") }));
        }
      } catch (err) {
        setSyncErrors((prev) => ({
          ...prev,
          [paymentId]: err instanceof Error ? err.message : t("payments.syncFailed"),
        }));
      }
      setSyncingPaymentId(null);
    },
    [syncPayment, t],
  );

  const handleSyncAll = useCallback(async () => {
    const staleIds = rows.filter(isHspStale).map((p) => p.id);
    if (staleIds.length === 0) return;
    await Promise.all(staleIds.map((id) => handleSyncPayment(id)));
    refetch();
  }, [rows, handleSyncPayment, refetch]);

  const handleDeletePayment = useCallback(
    async (paymentId: string) => {
      setDeletingPaymentId(paymentId);
      setDeleteErrors((prev) => {
        const next = { ...prev };
        delete next[paymentId];
        return next;
      });
      try {
        await deletePayment.mutateAsync(paymentId);
        if (expandedId === paymentId) setExpandedId(null);
      } catch (err) {
        setDeleteErrors((prev) => ({
          ...prev,
          [paymentId]: err instanceof Error ? err.message : t("payments.deleteFailed"),
        }));
      }
      setDeletingPaymentId(null);
    },
    [deletePayment, expandedId, t],
  );

  return (
    <PageContainer
      title={t("payments.title")}
      description={t("payments.desc")}
      icon={<Receipt className="h-5 w-5" />}
      action={
        <div className="flex gap-2">
          {rows.some(isHspStale) ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSyncAll}
              disabled={syncPayment.isPending}
              title={t("payments.syncAll")}
            >
              <RefreshCcw className={cn("h-3.5 w-3.5", syncPayment.isPending && "animate-spin")} />
              {t("payments.syncAll")}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {t("payments.refresh")}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t("payments.totalSent")}
          value={stats.totalSent.toFixed(2)}
          sublabel={t("payments.sublabelSettled", { count: stats.successCount, total: stats.totalCount })}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label={t("payments.successRate")}
          value={`${stats.successRate}%`}
          sublabel={t("payments.sublabelHspVerified", { count: stats.hspVerifiedCount })}
          icon={<Check className="h-4 w-4" />}
        />
        <StatCard
          label={t("payments.pending")}
          value={`${stats.pendingCount}`}
          sublabel={t("payments.sublabelPending")}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label={t("payments.anchored")}
          value={`${stats.anchoredCount}`}
          sublabel={t("payments.sublabelAnchored")}
          className="col-span-2 sm:col-span-1"
          icon={<Anchor className="h-4 w-4" />}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer",
                  filter === f.value
                    ? "bg-primary text-primary-foreground shadow-[0_2px_8px_-1px_rgba(105,1,208,0.4)]"
                    : "glass-item text-muted hover:text-foreground",
                )}
              >
                {f.value === "all" ? t("payments.all")
                  : f.value === "settled" ? t("payments.settled")
                  : f.value === "pending" ? t("payments.pending")
                  : f.value === "failed" ? t("payments.failed")
                  : t("payments.anchored")}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={handleToggleSort}>
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortBy === "recent" ? t("payments.sortRecent") : t("payments.sortHighest")}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("payments.loading")}
          </div>
        </Card>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<Filter className="h-6 w-6" />}
          title={rows.length === 0 ? t("payments.noPayments") : t("payments.noPaymentsFound")}
          description={
            rows.length === 0
              ? t("payments.noPaymentsDesc")
              : t("payments.noPaymentsFoundDesc")
          }
          action={
            rows.length === 0 ? (
              <Link href="/">
                <Button variant="primary" size="sm">
                  {t("payments.newViaChat")}
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((payment) => (
            <PaymentRow
              key={payment.id}
              payment={payment}
              isExpanded={expandedId === payment.id}
              onToggle={() => handleToggleExpand(payment.id)}
              onAnchor={canAnchor ? handleAnchorPayment : undefined}
              isAnchoring={anchoringPaymentId === payment.id}
              anchorError={anchorErrors[payment.id] ?? null}
              onSync={handleSyncPayment}
              isSyncing={syncingPaymentId === payment.id}
              syncError={syncErrors[payment.id] ?? null}
              onDelete={handleDeletePayment}
              isDeleting={deletingPaymentId === payment.id}
              deleteError={deleteErrors[payment.id] ?? null}
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
