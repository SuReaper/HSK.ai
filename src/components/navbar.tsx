"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { X, Menu } from "lucide-react";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

const WalletButton = dynamic(
  () => import("@/components/wallet-button").then((m) => m.WalletButton),
  { ssr: false },
);

const LanguageSelector = dynamic(
  () => import("@/components/language-selector").then((m) => m.LanguageSelector),
  { ssr: false },
);

const NAV_LINKS = ALL_NAV_ITEMS.filter((i) =>
  ["Chat", "Payments", "Recurring", "Contacts", "Wallet", "Settings"].includes(i.label),
);

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useI18n();

  const navLabelKey: Record<string, TranslationKey> = {
    Chat: "nav.chat",
    Payments: "nav.payments",
    Recurring: "nav.recurring",
    Contacts: "nav.contacts",
    Wallet: "nav.wallet",
    Settings: "nav.settings",
    Notifications: "nav.notifications",
    Security: "nav.security",
    About: "nav.about",
    Help: "nav.help",
  };

  function navLabel(label: string): string {
    const key = navLabelKey[label];
    return key ? t(key) : label;
  }

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 sm:px-6 sm:pt-4">
        <nav
          className={cn(
            "flex w-full max-w-5xl items-center justify-between neumorphic px-6 py-3 transition-all duration-500",
          )}
          style={{ borderRadius: 48 }}
        >
          <Link href="/" className="shrink-0">
            <Image
              src="/hskailogo.png"
              alt="HSK.ai"
              width={140}
              height={36}
              priority
              className="h-[32px] w-auto object-contain sm:h-[36px]"
            />
          </Link>

          <div className="hidden items-center gap-0.5 sm:flex">
            {NAV_LINKS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-2xl px-4 py-1.5 text-sm font-medium tracking-wide transition-all duration-200",
                    isActive
                      ? "text-white bg-white/15"
                      : "text-white/60 hover:text-white/90",
                  )}
                >
                  {navLabel(item.label)}
                </Link>
              );
            })}
          </div>

          <div className="hidden items-center sm:flex">
            <LanguageSelector />
            <WalletButton />
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:hidden"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          >
            {menuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </nav>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 flex flex-col bg-black/95 backdrop-blur-2xl px-6 pt-28"
          >
            <div className="mx-auto flex w-full max-w-sm flex-col gap-1">
              {ALL_NAV_ITEMS.map((item, i) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.25, ease: "easeOut" }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-4 rounded-2xl px-5 py-3.5 text-base font-medium transition-all duration-200",
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-white/50 hover:bg-white/5 hover:text-white/80",
                      )}
                    >
                      <Icon className={cn(
                        "h-5 w-5",
                        isActive ? "text-white" : "text-white/40",
                      )} />
                      <span>{navLabel(item.label)}</span>
                      {isActive ? (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60" />
                      ) : null}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            <div className="mx-auto mt-10 w-full max-w-sm border-t border-white/10 pt-6">
              <WalletButton />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
