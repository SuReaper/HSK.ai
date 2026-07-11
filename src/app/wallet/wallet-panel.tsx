"use client";

import {
  Wallet,
  ArrowUpFromLine,
  ArrowDownToLine,
  Copy,
  ExternalLink,
  Check,
  Network,
  Zap,
  AlertCircle,
  Link2,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, useMemo, memo, startTransition } from "react";
import { useAppKitSafe } from "@/lib/wagmi/appkit-init";
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useSwitchChain,
} from "wagmi";
import { formatUnits, erc20Abi } from "viem";
import { PageContainer } from "@/components/page-container";
import { Card, StatCard, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BASE_NETWORKS,
  networkName,
  NETWORKS_BY_ID,
  rpcUrl,
  explorerAddressUrl,
} from "@/lib/wagmi/chains";
import { cn } from "@/lib/utils";
import { CHAIN_CONFIGS } from "@/lib/chains";

function shorten(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const NetworkRow = memo(function NetworkRow({
  net,
  active,
  onSwitch,
}: {
  net: { id: number | string; name: string };
  active: boolean;
  onSwitch: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border px-4 py-3 transition-all",
        active
          ? "border-primary/40 bg-primary/10"
          : "border-border bg-surface-2/40 hover:border-primary/30",
      )}
    >
      <button type="button" onClick={onSwitch} disabled={active} className="flex-1 text-left">
        <p className="text-sm font-medium text-foreground">{net.name}</p>
        <p className="text-xs text-muted-2">Chain ID {net.id}</p>
      </button>
      <div className="flex items-center gap-2">
        {active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Check className="h-3 w-3" /> Active
          </span>
        ) : null}
      </div>
    </div>
  );
});

function ChainSwitchError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
      <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
      <p className="flex-1 text-xs text-danger">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-danger/60 hover:text-danger transition-colors"
      >
        <AlertCircle className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function WalletPanel() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { startTransition(() => setMounted(true)); }, []);

  const { open } = useAppKitSafe();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [copied, setCopied] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const native = useBalance({ address });

  const stablecoinAddr = useMemo(() => {
    if (!chainId) return null;
    const cfg = Object.values(CHAIN_CONFIGS).find((c) => c.chainId === chainId);
    return cfg?.stablecoin.address ?? null;
  }, [chainId]);

  const stablecoinSymbol = useMemo(() => {
    if (!chainId) return "USDC";
    const cfg = Object.values(CHAIN_CONFIGS).find((c) => c.chainId === chainId);
    return cfg?.stablecoin.symbol ?? "USDC";
  }, [chainId]);

  const stablecoinDecimals = useMemo(() => {
    if (!chainId) return 6;
    const cfg = Object.values(CHAIN_CONFIGS).find((c) => c.chainId === chainId);
    return cfg?.stablecoin.decimals ?? 6;
  }, [chainId]);

  const usdcBalance = useReadContract({
    address: stablecoinAddr ?? undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && stablecoinAddr) },
  });

  const usdcValue = usdcBalance.data
    ? Number(formatUnits(usdcBalance.data, stablecoinDecimals)).toLocaleString(
        undefined,
        { maximumFractionDigits: 6 },
      )
    : null;

  const chain = NETWORKS_BY_ID[chainId];

  const nativeDisplay = native.data
    ? Number(formatUnits(native.data.value, native.data.decimals)).toLocaleString(
        undefined,
        { maximumFractionDigits: 4 },
      )
    : "0";
  const nativeSymbol = native.data?.symbol ?? chain?.nativeCurrency.symbol ?? "HSK";

  const copyAddress = useCallback(() => {
    if (!address) return;
    navigator.clipboard?.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  const handleSwitchChain = useCallback(
    async (targetId: number) => {
      setSwitchError(null);
      try {
        await switchChainAsync({ chainId: targetId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to switch network.";
        if (msg.includes("rejected") || msg.includes("denied")) {
          setSwitchError("Chain switch was rejected by wallet.");
        } else if (msg.includes("Unrecognized chain")) {
          setSwitchError("This chain is not configured in your wallet. Switch manually from your wallet's network selector.");
        } else {
          setSwitchError("Could not switch chain. Try switching from your wallet directly.");
        }
      }
    },
    [switchChainAsync],
  );

  if (!mounted) {
    return (
      <PageContainer
        title="Wallet"
        description="Balances and network details"
        icon={<Wallet className="h-5 w-5" />}
      >
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          Loading…
        </div>
      </PageContainer>
    );
  }

  if (!isConnected || !address) {
    return (
      <PageContainer
        title="Wallet"
        description="Balances and network details"
        icon={<Wallet className="h-5 w-5" />}
      >
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No wallet connected"
          description="Connect a WalletConnect-compatible wallet to view your balances and send payments."
          action={
            <Button variant="primary" size="md" onClick={() => open()}>
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          }
        />

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Supported networks</h2>
          <div className="space-y-2">
            {BASE_NETWORKS.map((net) => (
              <div
                key={net.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{net.name}</p>
                  <p className="text-xs text-muted-2">
                    {net.nativeCurrency.symbol} · Chain ID {net.id}
                  </p>
                </div>
                <span className="font-mono text-xs text-muted">
                  {net.rpcUrls.default.http[0]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Wallet"
      description="Balances and network details"
      icon={<Wallet className="h-5 w-5" />}
    >
      {switchError ? (
        <ChainSwitchError message={switchError} onDismiss={() => setSwitchError(null)} />
      ) : null}

      <Card className="bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted">Connected wallet</p>
            <button
              type="button"
              onClick={copyAddress}
              className="mt-1 flex items-center gap-2 font-mono text-sm text-foreground hover:text-primary transition-colors"
            >
              {shorten(address)}
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-2" />
              )}
            </button>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Native balance</p>
            <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {native.isLoading ? "…" : `${nativeDisplay} ${nativeSymbol}`}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/">
            <Button variant="primary" size="sm">
              <ArrowUpFromLine className="h-4 w-4" />
              Send
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={copyAddress}>
            <ArrowDownToLine className="h-4 w-4" />
            Receive
          </Button>
          <Button variant="secondary" size="sm" onClick={() => open()}>
            <Zap className="h-4 w-4" />
            Manage
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Network"
          value={networkName(chainId)}
          sublabel={chain ? `Chain ID ${chain.id}` : "Unsupported"}
        />
        <StatCard
          label="Native token"
          value={chain?.nativeCurrency.symbol ?? "HSK"}
          sublabel={chain?.nativeCurrency.name ?? "HashKey Token"}
        />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Token balances</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-foreground">
                {chain?.nativeCurrency.symbol.slice(0, 2) ?? "HS"}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {chain?.nativeCurrency.symbol ?? "HSK"}
                </p>
                <p className="text-xs text-muted-2">{chain?.nativeCurrency.name ?? "HashKey Token"}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold text-foreground tabular-nums">
                {native.isLoading ? "…" : nativeDisplay}
              </p>
              <p className="text-xs text-muted-2">Native</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-foreground">
                {stablecoinSymbol.slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{stablecoinSymbol}</p>
                <p className="text-xs text-muted-2">Stablecoin</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold text-foreground tabular-nums">
                {usdcBalance.isLoading ? "…" : usdcValue ?? "0"}
              </p>
              <p className="text-xs text-muted-2">ERC-20</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Networks</h2>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BASE_NETWORKS.map((net) => (
            <NetworkRow
              key={net.id}
              net={{ id: net.id as number, name: net.name }}
              active={net.id === chainId}
              onSwitch={() => handleSwitchChain(net.id as number)}
            />
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted">
              <Network className="h-4 w-4" /> RPC endpoint
            </span>
            <a
              href={rpcUrl(chainId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-xs text-primary hover:underline"
            >
              {rpcUrl(chainId)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted">
              <Link2 className="h-4 w-4" /> Block explorer
            </span>
            <a
              href={explorerAddressUrl(chainId, address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-xs text-primary hover:underline"
            >
              {NETWORKS_BY_ID[chainId]?.blockExplorers?.default.url ?? "#"}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Chain ID</span>
            <span className="font-mono text-sm text-foreground">{chainId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Native decimals</span>
            <span className="font-mono text-sm text-foreground">
              {chain?.nativeCurrency.decimals ?? 18}
            </span>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
