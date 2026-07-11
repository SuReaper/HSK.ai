"use client";

import { create } from "zustand";
import { en } from "./en";
import { ja } from "./ja";
import type { Language, TranslationKey, TranslationDict } from "./types";

export type { TranslationKey } from "./types";

const STORAGE_KEY = "hsk-ai:language";

const DICTIONARIES: Record<Language, TranslationDict> = { en, ja };

function detectLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "en" || raw === "ja") return raw;
  } catch {}
  const browserLang = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "";
  if (browserLang.startsWith("ja")) return "ja";
  return "en";
}

interface I18nStore {
  language: Language;
  hydrated: boolean;
  setLanguage: (lang: Language) => void;
  hydrate: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  tLang: (en: string, ja: string) => string;
}

export const useI18n = create<I18nStore>((set, get) => ({
  language: "en",
  hydrated: false,
  setLanguage: (lang) => {
    if (typeof window !== "undefined") {
      try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "ja" ? "ja" : "en";
    }
    set({ language: lang });
  },
  hydrate: () => {
    if (get().hydrated) return;
    const lang = detectLanguage();
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "ja" ? "ja" : "en";
    }
    set({ language: lang, hydrated: true });
  },
  t: (key, params) => {
    const lang = get().language;
    let str = DICTIONARIES[lang]?.[key] ?? DICTIONARIES.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  },
  tLang: (enText, jaText) => {
    return get().language === "ja" ? jaText : enText;
  },
}));
