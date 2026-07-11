"use client";

import { memo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAccount } from "wagmi";
import { Bot, User, Copy, Pencil, Trash2, Check, ChevronRight, Brain } from "lucide-react";
import type { ChatMessageData } from "@/lib/types";
import { IntentCard } from "@/components/intent-card";
import { StatusPill } from "@/components/status-pill";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageData;
  onConfirmIntent?: (message: ChatMessageData) => void;
  onCancelIntent?: (message: ChatMessageData) => void;
  onCancelPayment?: (message: ChatMessageData) => void;
  onAnchor?: (message: ChatMessageData) => void;
  onCopy?: (message: ChatMessageData) => void;
  onEdit?: (message: ChatMessageData) => void;
  onDelete?: (message: ChatMessageData) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const spring = { type: "spring" as const, stiffness: 380, damping: 30 };

function MessageActions({
  message,
  isUser,
  onCopy,
  onEdit,
  onDelete,
}: {
  message: ChatMessageData;
  isUser: boolean;
  onCopy?: (m: ChatMessageData) => void;
  onEdit?: (m: ChatMessageData) => void;
  onDelete?: (m: ChatMessageData) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!message.content) return;
    navigator.clipboard?.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onCopy?.(message);
  }, [message, onCopy]);

  if (!onCopy && !onEdit && !onDelete) return null;

  return (
    <div className={cn(
      "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150",
      isUser ? "justify-end" : "justify-start pl-[42px]",
    )}>
      {onCopy ? (
        <button
          type="button"
          onClick={handleCopy}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-2 hover:text-foreground hover:bg-surface-2/60 transition-colors"
          title="Copy message"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        </button>
      ) : null}
      {isUser && onEdit ? (
        <button
          type="button"
          onClick={() => onEdit(message)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-2 hover:text-foreground hover:bg-surface-2/60 transition-colors"
          title="Edit message"
        >
          <Pencil className="h-3 w-3" />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={() => onDelete(message)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-2 hover:text-danger hover:bg-danger/10 transition-colors"
          title="Delete message"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function ReasoningBlock({ reasoning, streaming }: { reasoning: string; streaming?: boolean }) {
  const [open, setOpen] = useState(true);

  if (!reasoning.trim()) return null;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-foreground transition-colors"
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronRight className="h-3.5 w-3.5" />
        </motion.span>
        <Brain className="h-3.5 w-3.5 text-primary/80" />
        <span>{streaming ? "Thinking…" : "Thought process"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 rounded-2xl rounded-bl-md border-l-2 border-primary/40 bg-surface-2/20 px-3.5 py-2.5 text-[13px] leading-relaxed text-muted whitespace-pre-wrap">
              {reasoning}
              {streaming ? (
                <motion.span
                  className="ml-0.5 inline-block h-3.5 w-1.5 align-middle bg-primary/60"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export const ChatMessage = memo(function ChatMessage({
  message,
  onConfirmIntent,
  onCancelIntent,
  onCancelPayment,
  onAnchor,
  onCopy,
  onEdit,
  onDelete,
}: ChatMessageProps) {
  const { address } = useAccount();
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring}
        className="group flex flex-col items-end gap-0.5"
      >
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          <div className="flex items-end gap-2">
            <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground shadow-[0_4px_14px_-2px_rgba(105,1,208,0.5)]">
              {message.content}
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/30">
              <User className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
          </div>
          <time className="px-1 text-[11px] text-muted-2">{timeAgo(message.createdAt)}</time>
        </div>
        <MessageActions message={message} isUser onCopy={onCopy} onEdit={onEdit} onDelete={onDelete} />
      </motion.div>
    );
  }

  const hasContent = message.content && message.content.length > 0;
  const hasReasoning = !!message.reasoning && message.reasoning.length > 0;
  const streaming = message.streaming;
  const showWaiting = streaming && !hasContent && !hasReasoning && !message.intent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="group flex flex-col gap-0.5"
    >
      <div className="flex max-w-[85%] flex-col gap-1.5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col gap-1.5">
            {showWaiting ? (
              <div className="glass-tight flex items-center gap-1.5 rounded-2xl rounded-bl-md px-4 py-3 text-[13px] text-muted">
                <Brain className="h-3.5 w-3.5 text-primary/80" />
                <span>Thinking…</span>
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-muted"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
                  />
                ))}
              </div>
            ) : null}

            {hasReasoning ? (
              <ReasoningBlock reasoning={message.reasoning!} streaming={streaming} />
            ) : null}

            {hasContent ? (
              <div className="glass-tight rounded-2xl rounded-bl-md px-4 py-2.5 text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                {message.content}
                {streaming ? (
                  <motion.span
                    className="ml-0.5 inline-block h-3.5 w-1.5 align-middle bg-primary/60"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                  />
                ) : null}
              </div>
            ) : null}

            {message.intent ? (
              <IntentCard
                intent={message.intent}
                status={message.status}
                txHash={message.txHash}
                chainId={message.chainId}
                senderAddress={address ?? undefined}
                hspStatus={message.hspStatus}
                hspVerified={message.hspVerified}
                hspDecision={message.hspDecision}
                hspPaymentId={message.hspPaymentId}
                viaHsp={message.viaHsp}
                viaCcip={message.viaCcip}
                ccipMessageId={message.ccipMessageId}
                paymentStep={message.paymentStep}
                onConfirm={onConfirmIntent ? () => onConfirmIntent(message) : undefined}
                onCancel={onCancelIntent ? () => onCancelIntent(message) : undefined}
                onCancelPayment={onCancelPayment ? () => onCancelPayment(message) : undefined}
                paymentId={message.paymentId}
                anchored={message.anchored}
                isAnchoring={message.isAnchoring}
                anchorError={message.anchorError}
                onAnchor={onAnchor && message.paymentId ? () => onAnchor(message) : undefined}
              />
            ) : null}

            {message.status ? <StatusPill status={message.status} /> : null}
          </div>
        </div>
        <time className="pl-[42px] text-[11px] text-muted-2" title={formatTime(message.createdAt)}>
          {timeAgo(message.createdAt)}
        </time>
      </div>
      <MessageActions message={message} isUser={false} onCopy={onCopy} onDelete={onDelete} />
    </motion.div>
  );
});
