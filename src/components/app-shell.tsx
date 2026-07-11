"use client";

import { type ReactNode, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Web3Provider } from "@/components/providers/web3-provider";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { useI18n } from "@/lib/i18n";

export function AppShell({ children }: { children: ReactNode }) {
  const hydrate = useI18n((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Web3Provider>
      <LoadingOverlay />
      <div className="flex h-dvh flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </Web3Provider>
  );
}
