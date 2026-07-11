"use client";

import { useState, useCallback, startTransition } from "react";
import { Settings, Globe, Shield, Bell, Sliders, Wallet, Check, Brain, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/page-container";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { useChainId } from "wagmi";
import { networkName } from "@/lib/wagmi/chains";
import { useAiProvider, type AiProviderConfig } from "@/lib/ai/provider-store";
import { useI18n } from "@/lib/i18n";

function SettingRow({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-2">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const chainId = useChainId();
  const { config: aiConfig, setConfig: setAiConfig, configured: aiConfigured } = useAiProvider();
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [localAi, setLocalAi] = useState<AiProviderConfig>(aiConfig);
  const [lastAiConfig, setLastAiConfig] = useState<AiProviderConfig>(aiConfig);
  if (aiConfig !== lastAiConfig) {
    setLastAiConfig(aiConfig);
    setLocalAi(aiConfig);
  }

  const handleAiSave = useCallback(() => {
    setAiConfig(localAi);
    setAiSaved(true);
    setTimeout(() => setAiSaved(false), 2000);
  }, [localAi, setAiConfig]);

  const defaultSettings = {
    soundEnabled: false,
    hapticsEnabled: false,
    autoConfirm: false,
    showBalances: false,
    gasEstimates: false,
    biometricLock: false,
    analyticsEnabled: false,
    crashReports: false,
  };

  const [settings, setSettings] = useState<typeof defaultSettings>(() => {
    if (typeof window === "undefined") return defaultSettings;
    const stored = JSON.parse(localStorage.getItem("hsk-ai:settings") ?? "{}");
    return {
      ...defaultSettings,
      ...stored,
    };
  });

  const toggle = useCallback((key: keyof typeof settings) => {
    startTransition(() => {
      setSettings((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        const stored = JSON.parse(localStorage.getItem("hsk-ai:settings") ?? "{}");
        stored[key] = next[key];
        localStorage.setItem("hsk-ai:settings", JSON.stringify(stored));
        return next;
      });
    });
  }, []);

  return (
    <PageContainer
      title={t("settings.title")}
      description={t("settings.desc")}
      icon={<Settings className="h-5 w-5" />}
    >
      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Sliders className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">{t("settings.appearance")}</h2>
        </div>
        <div className="divide-y divide-border">
          <SettingRow
            icon={<Sliders className="h-4 w-4" />}
            label={t("settings.showBalances")}
            description={t("settings.showBalancesDesc")}
          >
            <Toggle checked={settings.showBalances} onChange={() => toggle("showBalances")} />
          </SettingRow>
          <SettingRow
            icon={<Globe className="h-4 w-4" />}
            label={t("settings.gasEstimates")}
            description={t("settings.gasEstimatesDesc")}
          >
            <Toggle checked={settings.gasEstimates} onChange={() => toggle("gasEstimates")} />
          </SettingRow>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">{t("settings.notificationsFeedback")}</h2>
        </div>
        <div className="divide-y divide-border">
          <SettingRow
            icon={<Bell className="h-4 w-4" />}
            label={t("settings.soundAlerts")}
            description={t("settings.soundAlertsDesc")}
          >
            <Toggle checked={settings.soundEnabled} onChange={() => toggle("soundEnabled")} />
          </SettingRow>
          <SettingRow
            icon={<Sliders className="h-4 w-4" />}
            label={t("settings.hapticFeedback")}
            description={t("settings.hapticFeedbackDesc")}
          >
            <Toggle checked={settings.hapticsEnabled} onChange={() => toggle("hapticsEnabled")} />
          </SettingRow>
          <SettingRow
            icon={<Shield className="h-4 w-4" />}
            label={t("settings.autoConfirm")}
            description={t("settings.autoConfirmDesc")}
          >
            <Toggle checked={settings.autoConfirm} onChange={() => toggle("autoConfirm")} />
          </SettingRow>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">{t("settings.securityPrivacy")}</h2>
        </div>
        <div className="divide-y divide-border">
          <SettingRow
            icon={<Shield className="h-4 w-4" />}
            label={t("settings.biometricLock")}
            description={t("settings.biometricLockDesc")}
          >
            <Toggle checked={settings.biometricLock} onChange={() => toggle("biometricLock")} />
          </SettingRow>
          <SettingRow
            icon={<Shield className="h-4 w-4" />}
            label={t("settings.analytics")}
            description={t("settings.analyticsDesc")}
          >
            <Toggle checked={settings.analyticsEnabled} onChange={() => toggle("analyticsEnabled")} />
          </SettingRow>
          <SettingRow
            icon={<Shield className="h-4 w-4" />}
            label={t("settings.crashReports")}
            description={t("settings.crashReportsDesc")}
          >
            <Toggle checked={settings.crashReports} onChange={() => toggle("crashReports")} />
          </SettingRow>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Brain className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">{t("settings.aiProvider")}</h2>
          {aiConfigured ? (
            <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              {t("settings.connected")}
            </span>
          ) : (
            <span className="ml-auto rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
              {t("settings.notConfigured")}
            </span>
          )}
        </div>

        <div className="divide-y divide-border">
          <SettingRow
            icon={<Globe className="h-4 w-4" />}
            label={t("settings.apiBaseUrl")}
            description={t("settings.apiBaseUrlDesc")}
          >
            <input
              type="url"
              value={localAi.baseUrl}
              onChange={(e) => setLocalAi({ ...localAi, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-44 rounded-lg border border-border bg-surface-2/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-3 focus:border-primary/50 focus:outline-none font-mono"
            />
          </SettingRow>

          <SettingRow
            icon={<Shield className="h-4 w-4" />}
            label={t("settings.apiKey")}
            description={t("settings.apiKeyDesc")}
          >
            <div className="relative">
              <input
                type={showAiKey ? "text" : "password"}
                value={localAi.apiKey}
                onChange={(e) => setLocalAi({ ...localAi, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-44 rounded-lg border border-border bg-surface-2/50 px-2.5 py-1.5 pr-8 text-xs text-foreground placeholder:text-muted-3 focus:border-primary/50 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowAiKey(!showAiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-2 hover:text-foreground"
              >
                {showAiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </SettingRow>

          <SettingRow
            icon={<Sliders className="h-4 w-4" />}
            label={t("settings.model")}
            description={t("settings.modelDesc")}
          >
            <input
              type="text"
              value={localAi.model}
              onChange={(e) => setLocalAi({ ...localAi, model: e.target.value })}
              placeholder="gpt-4o"
              className="w-44 rounded-lg border border-border bg-surface-2/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-3 focus:border-primary/50 focus:outline-none font-mono"
            />
          </SettingRow>

          <SettingRow
            icon={<Sliders className="h-4 w-4" />}
            label={t("settings.temperature")}
            description={t("settings.temperatureDesc")}
          >
            <input
              type="number"
              step={0.1}
              min={0}
              max={2}
              value={localAi.temperature}
              onChange={(e) => setLocalAi({ ...localAi, temperature: parseFloat(e.target.value) || 0 })}
              className="w-44 rounded-lg border border-border bg-surface-2/50 px-2.5 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none font-mono"
            />
          </SettingRow>

          <SettingRow
            icon={<Sliders className="h-4 w-4" />}
            label={t("settings.topP")}
            description={t("settings.topPDesc")}
          >
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={localAi.topP}
              onChange={(e) => setLocalAi({ ...localAi, topP: parseFloat(e.target.value) || 0 })}
              className="w-44 rounded-lg border border-border bg-surface-2/50 px-2.5 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none font-mono"
            />
          </SettingRow>

          <SettingRow
            icon={<Sliders className="h-4 w-4" />}
            label={t("settings.maxTokens")}
            description={t("settings.maxTokensDesc")}
          >
            <input
              type="number"
              value={localAi.maxTokens ?? ""}
              onChange={(e) =>
                setLocalAi({ ...localAi, maxTokens: e.target.value === "" ? null : parseInt(e.target.value, 10) })
              }
              placeholder="auto"
              className="w-44 rounded-lg border border-border bg-surface-2/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-3 focus:border-primary/50 focus:outline-none font-mono"
            />
          </SettingRow>

          <SettingRow
            icon={<Brain className="h-4 w-4" />}
            label={t("settings.showThinking")}
            description={t("settings.showThinkingDesc")}
          >
            <Toggle
              checked={localAi.showThinking}
              onChange={() => setLocalAi({ ...localAi, showThinking: !localAi.showThinking })}
            />
          </SettingRow>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={handleAiSave} disabled={!localAi.apiKey}>
            {aiSaved ? (
              <>
                <Check className="h-3.5 w-3.5" /> {t("settings.saved")}
              </>
            ) : (
              t("settings.saveAi")
            )}
          </Button>
          <p className="text-[10px] text-muted-3">
            {t("settings.keyLocalNote")}
          </p>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">{t("settings.network")}</h2>
        </div>
        <div className="divide-y divide-border">
          <SettingRow
            icon={<Globe className="h-4 w-4" />}
            label={t("settings.activeNetwork")}
            description={t("settings.activeNetworkDesc", { network: networkName(chainId), chainId })}
          >
            <Link href="/wallet">
              <Button variant="secondary" size="sm">{t("settings.manage")}</Button>
            </Link>
          </SettingRow>
        </div>
      </Card>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm">
          {t("settings.resetDefaults")}
        </Button>
        <Button variant="primary" size="sm">
          {t("settings.saveChanges")}
        </Button>
      </div>
    </PageContainer>
  );
}
