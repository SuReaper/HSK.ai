"use client";

import { create } from "zustand";

export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number | null;
  showThinking: boolean;
}

const STORAGE_KEY = "hsk-ai:ai-provider";

export const DEFAULT_PROVIDER: AiProviderConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o",
  temperature: 0.7,
  topP: 1,
  maxTokens: null,
  showThinking: false,
};

function loadConfig(): AiProviderConfig {
  if (typeof window === "undefined") return { ...DEFAULT_PROVIDER };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AiProviderConfig>;
      return {
        baseUrl: p.baseUrl ?? DEFAULT_PROVIDER.baseUrl,
        apiKey: p.apiKey ?? "",
        model: p.model ?? DEFAULT_PROVIDER.model,
        temperature: typeof p.temperature === "number" ? p.temperature : DEFAULT_PROVIDER.temperature,
        topP: typeof p.topP === "number" ? p.topP : DEFAULT_PROVIDER.topP,
        maxTokens: typeof p.maxTokens === "number" ? p.maxTokens : null,
        showThinking: p.showThinking === true,
      };
    }
  } catch {}
  return { ...DEFAULT_PROVIDER };
}

function saveConfig(config: AiProviderConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

interface AiProviderStore {
  config: AiProviderConfig;
  configured: boolean;
  setConfig: (config: AiProviderConfig) => void;
  resetConfig: () => void;
}

export const useAiProvider = create<AiProviderStore>((set) => ({
  config: loadConfig(),
  configured: loadConfig().apiKey.length > 0,
  setConfig: (config) => {
    saveConfig(config);
    set({ config, configured: config.apiKey.length > 0 });
  },
  resetConfig: () => {
    saveConfig({ ...DEFAULT_PROVIDER });
    set({ config: { ...DEFAULT_PROVIDER }, configured: false });
  },
}));
