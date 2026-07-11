"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "@/lib/i18n";
import { LANGUAGES, type Language } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
          "text-white/60 hover:text-white/90 hover:bg-white/10",
        )}
        aria-label={t("common.language")}
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{current.flag}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <div className="fixed inset-0 z-[300]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="glass-dropdown absolute right-0 top-full z-[301] mt-1 w-44 rounded-2xl border border-border shadow-2xl"
            >
              <div className="p-1.5">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code as Language);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                      language === lang.code
                        ? "bg-primary/10 text-primary"
                        : "text-muted hover:bg-surface-2/50",
                    )}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span className="flex-1 text-left font-medium">{lang.label}</span>
                    {language === lang.code ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
