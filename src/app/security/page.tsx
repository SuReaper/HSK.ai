"use client";

import { ShieldCheck, Lock, FileText, KeyRound, AlertTriangle } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { Card, StatCard, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  ip: string;
  timestamp: string;
  level: "info" | "warning" | "danger";
}

const AUDIT_LOGS: AuditEntry[] = [
  { id: "l1", action: "Wallet connected", actor: "0xA11ce…1234", ip: "192.168.1.42", timestamp: "2h ago", level: "info" },
  { id: "l2", action: "Payment signed (25 USDC)", actor: "0xA11ce…1234", ip: "192.168.1.42", timestamp: "2h ago", level: "info" },
  { id: "l3", action: "Session started", actor: "browser", ip: "192.168.1.42", timestamp: "2h ago", level: "info" },
  { id: "l4", action: "Payment failed (100 USDC)", actor: "0xA11ce…1234", ip: "192.168.1.42", timestamp: "2d ago", level: "warning" },
  { id: "l5", action: "Wallet disconnected", actor: "0xA11ce…1234", ip: "192.168.1.42", timestamp: "3d ago", level: "info" },
];

const levelStyles: Record<AuditEntry["level"], string> = {
  info: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

export default function SecurityPage() {
  return (
    <PageContainer
      title="Security"
      description="Audit logs, permissions, and account safety"
      icon={<ShieldCheck className="h-5 w-5" />}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="2FA Status" value="Disabled" sublabel="Recommended" />
        <StatCard label="Active sessions" value="1" sublabel="Current browser" />
        <StatCard
          label="Audit events"
          value={`${AUDIT_LOGS.length}`}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">Access & Authentication</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div className="flex items-center gap-3">
              <KeyRound className="h-4 w-4 text-muted" />
              <div>
                <p className="text-sm font-medium text-foreground">Two-factor authentication</p>
                <p className="text-xs text-muted-2">Add an extra layer of security</p>
              </div>
            </div>
            <Button variant="secondary" size="sm">Enable</Button>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <div>
                <p className="text-sm font-medium text-foreground">Recovery phrase</p>
                <p className="text-xs text-muted-2">Back up your wallet seed phrase</p>
              </div>
            </div>
            <Button variant="secondary" size="sm">View</Button>
          </div>
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex items-center gap-2 px-5 pt-5">
          <FileText className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">Audit log</h2>
        </div>
        {AUDIT_LOGS.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="No audit events" />
          </div>
        ) : (
          <div className="divide-y divide-border px-5 py-3">
            {AUDIT_LOGS.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${levelStyles[entry.level]}`}
                >
                  {entry.level === "info" ? "i" : entry.level === "warning" ? "!" : "x"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{entry.action}</p>
                  <p className="truncate font-mono text-xs text-muted-2">
                    {entry.actor} · {entry.ip}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-2">{entry.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">Permissions</h2>
        </div>
        <div className="space-y-2">
          {[
            { name: "Read wallet address", desc: "Required to identify your account", granted: true },
            { name: "Sign transactions", desc: "Required to approve payments", granted: true },
            { name: "Read token balances", desc: "Required to show balances on wallet page", granted: true },
            { name: "Post to social", desc: "Optional — share payment receipts", granted: false },
          ].map((perm) => (
            <div key={perm.name} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{perm.name}</p>
                <p className="text-xs text-muted-2">{perm.desc}</p>
              </div>
              {perm.granted ? (
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">Granted</span>
              ) : (
                <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-medium text-muted">Not granted</span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
