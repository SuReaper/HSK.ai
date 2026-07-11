"use client";

import { useRef, useState, useEffect, type KeyboardEvent, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, Square } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  prefill?: string;
  onStop?: () => void;
  isGenerating?: boolean;
}

export function ChatInput({ onSend, disabled, prefill, onStop, isGenerating }: ChatInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastPrefill = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prefill !== undefined && prefill !== lastPrefill.current) {
      setValue(prefill);
      lastPrefill.current = prefill;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }
  }, [prefill]);

  function autoresize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function send() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    lastPrefill.current = undefined;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) el.style.height = "auto";
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send();
  }

  const canSend = value.trim().length > 0 && !disabled;
  const showStop = isGenerating && onStop;

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div
        className={cn(
          "glass-tight flex items-center gap-2 rounded-2xl p-2 transition-all duration-200",
          "focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_rgba(157,99,242,0.15)]",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoresize();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.send")}
          className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed text-foreground placeholder:text-muted-2 focus:outline-none"
        />
        <AnimatePresence mode="wait" initial={false}>
          {showStop ? (
            <motion.button
              key="stop"
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={onStop}
              aria-label={t("chat.stop")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger ring-1 ring-danger/30 transition-all duration-200 cursor-pointer hover:bg-danger/25 hover:ring-danger/40"
            >
              <Square className="h-4 w-4 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              type="submit"
              whileTap={{ scale: 0.88 }}
              disabled={!canSend}
              aria-label={t("chat.send")}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                canSend
                  ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-2px_rgba(105,1,208,0.5)]"
                  : "bg-surface-2 text-muted-2 cursor-not-allowed",
              )}
            >
              <ArrowUp className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
