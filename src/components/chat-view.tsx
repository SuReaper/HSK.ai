"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo, startTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAccount, useBalance, useChainId } from "wagmi";
import type { ChatMessageData, PaymentIntent } from "@/lib/types";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { AiProviderButton } from "@/components/ai-provider-button";
import { Sparkles, Plus, MessageSquare, Trash2, X, Menu, Pencil } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { useSettlePayment } from "@/lib/use-settle-payment";
import { useCcipBridge } from "@/lib/use-ccip-bridge";
import { useAnchorIntent } from "@/lib/use-anchor-intent";
import { useTokenBalances } from "@/lib/use-token-balances";
import { isHashKeyChain, networkName, explorerTxUrl, getUsdc } from "@/lib/wagmi/chains";
import { useAiProvider } from "@/lib/ai/provider-store";
import { useChatStore, newChatMsgId } from "@/lib/chat/chat-store";
import { useAppKitSafe } from "@/lib/wagmi/appkit-init";
import { firePaymentConfetti } from "@/lib/confetti";
import { useI18n } from "@/lib/i18n";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";
import { ModelPicker } from "@/components/model-picker";
import { cn } from "@/lib/utils";

function newMessage(
  role: ChatMessageData["role"],
  content: string,
  extra?: Partial<ChatMessageData>,
): ChatMessageData {
  return {
    id: newChatMsgId(),
    role,
    content,
    createdAt: Date.now(),
    ...extra,
  };
}

type StreamLine =
  | { type: "reasoning"; text: string }
  | { type: "text"; text: string }
  | { type: "tool_start"; toolName: string; input?: unknown }
  | { type: "intent"; intent: PaymentIntent }
  | { type: "error"; error: string }
  | { type: "debug"; msg: string; [k: string]: unknown }
  | { type: "done"; finishReason: string; toolCalled?: boolean; toolResult?: boolean };

export function ChatView() {
  const { sessions, order, activeId, newChat, selectChat, deleteChat, renameChat, setChatModelOverride } = useChatStore();

  const [isThinking, setIsThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [editingPrefill, setEditingPrefill] = useState<string | undefined>(undefined);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const pollingRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const pollingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const confettiFiredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pollers = pollingRef.current;
    const timeouts = pollingTimeouts.current;
    const confettiSet = confettiFiredRef.current;
    return () => {
      pollers.forEach((interval) => clearInterval(interval));
      pollers.clear();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      confettiSet.clear();
    };
  }, []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { startTransition(() => setMounted(true)); }, []);

  const { open } = useAppKitSafe();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { settle, isSettling, cancelSettlement } = useSettlePayment();
  const ccipBridge = useCcipBridge();
  const { anchor, canAnchor } = useAnchorIntent();
  const { config, configured } = useAiProvider();
  const { t } = useI18n();
  const tokenBalances = useTokenBalances();
  const { data: nativeBalance } = useBalance({ address });

  const activeSession = activeId ? sessions[activeId] ?? null : null;
  const messages = useMemo(() => activeSession?.messages ?? [], [activeSession]);

  const ensureSession = useCallback((): string => {
    if (activeId && sessions[activeId]) return activeId;
    return newChat();
  }, [activeId, sessions, newChat]);

  const startPolling = useCallback((paymentId: string, messageId: string) => {
    if (pollingRef.current.has(messageId)) return;
    pollingRef.current.forEach((interval) => clearInterval(interval));
    pollingRef.current.clear();
    pollingTimeouts.current.forEach((t) => clearTimeout(t));
    pollingTimeouts.current.clear();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}`, { cache: "no-store" });
        if (!res.ok) return;
        const { payment } = (await res.json()) as {
          payment: {
            status: string;
            txHash?: string | null;
            hspStatus?: string | null;
            hspVerified?: boolean | null;
            hspDecision?: string | null;
            hspPaymentId?: string | null;
          };
        };
        const sid = useChatStore.getState().activeId;
        if (!sid) return;
        useChatStore.getState().updateMessage(sid, messageId, (m) => {
          if (payment.status === "settled") {
            clearInterval(interval);
            pollingRef.current.delete(messageId);
            if (!confettiFiredRef.current.has(messageId)) {
              confettiFiredRef.current.add(messageId);
              firePaymentConfetti();
            }
            return {
              ...m,
              status: "settled",
              txHash: payment.txHash ?? m.txHash,
              hspStatus: payment.hspStatus ?? undefined,
              hspVerified: payment.hspVerified ?? undefined,
              hspDecision: payment.hspDecision ?? undefined,
              hspPaymentId: payment.hspPaymentId ?? m.hspPaymentId,
            };
          }
          if (payment.status === "failed") {
            clearInterval(interval);
            pollingRef.current.delete(messageId);
            return { ...m, status: "failed" };
          }
          return {
            ...m,
            hspStatus: payment.hspStatus ?? m.hspStatus,
            hspVerified: payment.hspVerified ?? m.hspVerified,
            hspDecision: payment.hspDecision ?? m.hspDecision,
            hspPaymentId: payment.hspPaymentId ?? m.hspPaymentId,
          };
        });
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    pollingRef.current.set(messageId, interval);

    const timeout = setTimeout(() => {
      const existing = pollingRef.current.get(messageId);
      if (existing) {
        clearInterval(existing);
        pollingRef.current.delete(messageId);
      }
      pollingTimeouts.current.delete(messageId);

      const sid = useChatStore.getState().activeId;
      if (sid) {
        useChatStore.getState().updateMessage(sid, messageId, (m) => {
          if (m.status === "settled" || m.status === "failed") return m;
          return {
            ...m,
            status: "sent",
            paymentStep: "sent",
            viaHsp: m.viaHsp ?? true,
          };
        });

        const msg = useChatStore.getState().sessions[sid]?.messages.find((m) => m.id === messageId);
        if (msg?.paymentId) {
          fetch(`/api/payments/${msg.paymentId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "sent" }),
          }).catch(() => {});
        }
      }
    }, 120_000);

    pollingTimeouts.current.set(messageId, timeout);
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

  const callAiStream = useCallback(
    async (
      userText: string,
      assistantId: string,
      session: string,
      signal?: AbortSignal,
    ): Promise<{ error: string | null; errorCode: string | null; aborted: boolean }> => {
      try {
        const sid = useChatStore.getState().activeId;
        const currentSession = sid ? useChatStore.getState().sessions[sid] : null;
        const effectiveModel = currentSession?.modelOverride ?? config.model;
        const currentMessages = sid ? (useChatStore.getState().sessions[sid]?.messages ?? []) : [];
        const chatHistory = currentMessages
          .filter((m) => m.id !== assistantId)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
        chatHistory.push({ role: "user", content: userText });

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: chatHistory,
            providerConfig: {
              baseUrl: config.baseUrl,
              apiKey: config.apiKey,
              model: effectiveModel,
              temperature: config.temperature,
              topP: config.topP,
              maxTokens: config.maxTokens,
              showThinking: config.showThinking,
            },
            wallet: isConnected
              ? {
                  address: address ?? null,
                  chainId: chainId ?? null,
                  holdings: (() => {
                    const h: Record<string, { address: string | null; balance: string }> = {};
                    if (nativeBalance?.value) {
                      const nativeSym = chainId === 1 ? "ETH" : "HSK";
                      h[nativeSym] = { address: null, balance: nativeBalance.value.toString() };
                    }
                    if (tokenBalances.data) {
                      for (const t of tokenBalances.data) {
                        h[t.symbol] = { address: t.address, balance: t.balance };
                      }
                    }
                    return Object.keys(h).length > 0 ? h : null;
                  })(),
                }
              : null,
          }),
          signal,
        });

        if (!res.ok || !res.body) {
          let err = t("chat.errorRequestFailed");
          let code = "unknown";
          try {
            const b = await res.json();
            err = b.error ?? err;
            code = b.code ?? code;
          } catch {}
          return { error: err, errorCode: code, aborted: false };
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const patch = (updater: (m: ChatMessageData) => ChatMessageData) => {
          useChatStore.getState().updateMessage(session, assistantId, updater);
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            let evt: StreamLine;
            try {
              evt = JSON.parse(line) as StreamLine;
            } catch {
              continue;
            }
            switch (evt.type) {
              case "reasoning":
                patch((m) => ({ ...m, reasoning: (m.reasoning ?? "") + evt.text }));
                break;
              case "text":
                patch((m) => ({ ...m, content: (m.content ?? "") + evt.text }));
                break;
              case "tool_start":
                console.log("[chat] tool_start:", evt.toolName, "input:", evt.input);
                break;
              case "intent":
                patch((m) => ({ ...m, intent: evt.intent, status: "reviewing" }));
                break;
              case "debug":
                console.log("[chat] debug:", evt);
                if (evt.msg === "truncated-tool-call") {
                  patch((m) => ({
                    ...m,
                    reasoning: (m.reasoning ?? "") +
                      `\n\n[debug] Tool call was truncated mid-argument (${evt.toolInputDeltas} deltas, ${evt.finishReason}). Raise maxTokens — reasoning models need a large output budget.`,
                  }));
                } else if (evt.msg === "no-tool-call") {
                  patch((m) => ({
                    ...m,
                    reasoning: (m.reasoning ?? "") +
                      `\n\n[debug] Model did not call create_intent_card (${evt.finishReason}).`,
                  }));
                }
                break;
              case "error":
                return { error: evt.error, errorCode: "ai-error", aborted: false };
              case "done":
                console.log("[chat] done:", evt);
                break;
            }
          }
        }

        patch((m) => ({ ...m, streaming: false }));
        return { error: null, errorCode: null, aborted: false };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          useChatStore.getState().updateMessage(session, assistantId, (m) => ({ ...m, streaming: false }));
          return { error: null, errorCode: null, aborted: true };
        }
        const msg = err instanceof Error ? err.message : t("chat.errorNetwork");
        useChatStore.getState().updateMessage(session, assistantId, (m) => ({ ...m, streaming: false }));
        return { error: t("chat.errorConnectionFailed", { msg }), errorCode: "network-error", aborted: false };
      }
    },
    [config, isConnected, chainId, address, nativeBalance, tokenBalances, t],
  );

  const handleSend = useCallback(
    async (text: string) => {
      const editMsgId = editingMessageId;
      setEditingPrefill(undefined);
      setEditingMessageId(null);
      const sid = ensureSession();

      if (editMsgId) {
        useChatStore.getState().updateMessage(sid, editMsgId, (m) => ({ ...m, content: text }));
      } else {
        useChatStore.getState().addMessage(sid, newMessage("user", text));
      }
      setIsThinking(true);

      if (!configured) {
        setIsThinking(false);
        useChatStore.getState().addMessage(
          sid,
          newMessage(
            "assistant",
            t("chat.notConfigured"),
          ),
        );
        return;
      }

      const assistantId = newChatMsgId();
      useChatStore.getState().addMessage(
        sid,
        newMessage("assistant", "", {
          id: assistantId,
          streaming: true,
          aiGenerated: true,
        }),
      );

      const controller = new AbortController();
      abortRef.current = controller;

      const result = await callAiStream(text, assistantId, sid, controller.signal);
      abortRef.current = null;
      setIsThinking(false);

      if (result.aborted) return;

      if (result.error) {
        let errorContent = t("chat.errorEncountered", { error: result.error });
        if (result.errorCode === "invalid-key") {
          errorContent = t("chat.errorInvalidKey");
        } else if (result.errorCode === "no-api-key") {
          errorContent = t("chat.errorNoApiKey");
        } else if (result.errorCode === "rate-limited") {
          errorContent = t("chat.errorRateLimit");
        }
        useChatStore.getState().updateMessage(sid, assistantId, (m) => ({
          ...m,
          streaming: false,
          content: m.content || errorContent,
          reasoning: m.reasoning,
        }));
      }
    },
    [configured, callAiStream, ensureSession, setEditingPrefill, editingMessageId, setEditingMessageId, t],
  );

  const handleCancelPayment = useCallback(
    (message: ChatMessageData) => {
      cancelSettlement();
      const sid = activeId ?? ensureSession();
      useChatStore.getState().updateMessage(sid, message.id, (m) => ({
        ...m,
        status: "failed",
        paymentStep: "failed",
      }));
    },
    [activeId, ensureSession, cancelSettlement],
  );

  const handleConfirm = useCallback(
    async (message: ChatMessageData) => {
      if (!message.intent) return;
      if (!isConnected) {
        open();
        return;
      }
      const sid = ensureSession();

      // ─── Cross-chain CCIP flow ───
      if (message.intent.crossChain) {
        const ccipIntent = message.intent.crossChain;

        useChatStore.getState().updateMessage(sid, message.id, (m) => ({
          ...m,
          status: "signing",
          paymentStep: "transfer-signing",
          viaCcip: true,
        }));

        // Fetch the chain selector from the server
        let chainSelector: string | undefined;
        try {
          const destRes = await fetch("/api/ccip/destinations").then((r) => r.json());
          const dest = destRes?.destinations?.find(
            (d: { chainId: number; chainSelector: string }) => d.chainId === ccipIntent.destChainId,
          );
          chainSelector = dest?.chainSelector;
        } catch {
          // fall through
        }

        if (!chainSelector) {
          useChatStore.getState().updateMessage(sid, message.id, (m) => ({
            ...m,
            status: "failed",
          }));
          useChatStore.getState().addMessage(
            sid,
            newMessage(
              "assistant",
              `Cross-chain destination ${ccipIntent.destChainName} is not supported.`,
            ),
          );
          return;
        }

        // Get the CCIP-BnM token address from the source chain TOKENS map.
        // CCIP source is always Ethereum Sepolia (11155111) per our architecture.
        const srcChainId = 11155111;
        const tokenInfo = getUsdc(srcChainId);
        if (!tokenInfo?.address) {
          useChatStore.getState().updateMessage(sid, message.id, (m) => ({
            ...m,
            status: "failed",
          }));
          useChatStore.getState().addMessage(
            sid,
            newMessage(
              "assistant",
              `CCIP-BnM token not found on Ethereum Sepolia.`,
            ),
          );
          return;
        }
        const tokenAddress = tokenInfo.address as `0x${string}`;

        const result = await ccipBridge.send({
          destChainSelector: chainSelector,
          destChainId: ccipIntent.destChainId,
          receiver: ccipIntent.destRecipientAddress,
          tokenAddress,
          tokenAmount: BigInt(message.intent.amountBaseUnits),
          tokenSymbol: message.intent.token,
          amountHuman: message.intent.amountHuman,
          recipientLabel: message.intent.recipientLabel,
          memo: message.intent.memo ?? null,
        });

        if (result.status === "settled") {
          if (!confettiFiredRef.current.has(message.id)) {
            confettiFiredRef.current.add(message.id);
            firePaymentConfetti();
          }
          useChatStore.getState().updateMessage(sid, message.id, (m) => ({
            ...m,
            status: "settled",
            txHash: result.txHash,
            paymentId: result.id,
            chainId: 11155111,
            ccipMessageId: result.messageId,
            ccipExplorerUrl: result.ccipExplorerUrl,
            viaCcip: true,
            paymentStep: "settled",
          }));
        } else if (result.status === "failed" || result.status === "declined") {
          useChatStore.getState().updateMessage(sid, message.id, (m) => ({
            ...m,
            status: "failed",
          }));
          if (result.status === "failed") {
            useChatStore.getState().addMessage(
              sid,
              newMessage("assistant", `CCIP send failed: ${result.error}`),
            );
          }
        }
        return;
      }

      // ─── Same-chain flow (existing) ───

      // HSP-eligible tokens (USDC/USDC.e) require HashKey Chain Testnet (133)
      // because the HSP sandbox coordinator is testnet-only. If the wallet is
      // on mainnet (177), useSettlePayment will force-switch to testnet before
      // broadcasting. Native-token transfers can proceed on either HSK chain,
      // and plain / custom ERC-20 transfers fall back to the wallet's chain.
      // We still check isHashKeyChain() here so non-HashKey-chain wallets (e.g.
      // Ethereum mainnet) are rejected up-front before any DB write.
      if (!isHashKeyChain(chainId)) {
        useChatStore.getState().updateMessage(sid, message.id, (m) => ({ ...m, status: "failed" }));
        useChatStore.getState().addMessage(
          sid,
          newMessage(
            "assistant",
            t("chat.wrongChain", { network: networkName(chainId) }),
          ),
        );
        return;
      }

      useChatStore.getState().updateMessage(sid, message.id, (m) => ({ ...m, status: "signing", paymentStep: undefined }));

      const result = await settle(
        message.intent,
        (step, ctx) => {
          useChatStore.getState().updateMessage(sid, message.id, (m) => ({
            ...m,
            paymentStep: step,
            ...(ctx?.viaHsp != null ? { viaHsp: ctx.viaHsp } : {}),
            ...(ctx?.hspPaymentId != null ? { hspPaymentId: ctx.hspPaymentId } : {}),
            ...(ctx?.txHash != null ? { txHash: ctx.txHash } : {}),
            ...(step === "failed" ? { status: "failed" } : step === "settled" ? { status: "settled" } : {}),
          }));
        },
      );

      const isFailure = result.status === "failed" || result.status === "pending";

      const hspFields =
        "viaHsp" in result && result.viaHsp
          ? {
              viaHsp: true,
              hspStatus: ("hspStatus" in result ? result.hspStatus : null) as string | null | undefined,
              hspVerified: ("hspVerified" in result ? result.hspVerified : null) as boolean | null | undefined,
              hspDecision: ("hspDecision" in result ? result.hspDecision : null) as string | null | undefined,
              hspPaymentId: ("hspPaymentId" in result ? result.hspPaymentId : null) as string | null | undefined,
            }
          : {};

      useChatStore.getState().updateMessage(sid, message.id, (m) => ({
        ...m,
        status: isFailure
          ? "failed"
          : result.status === "settled" || result.status === "sent"
            ? "settled"
            : "signing",
        txHash: "txHash" in result ? result.txHash : m.txHash,
        paymentId: result.id || m.paymentId,
        // HSP-eligible payments always settle on testnet (133) — the on-chain
        // transfer and mandate must be on the same chain. Native-token transfers
        // use the wallet's actual chain. If viaHsp was true the chain was forced
        // to 133 by useSettlePayment, so trust that.
        chainId: "viaHsp" in result && result.viaHsp ? 133 : (chainId ?? 133),
        paymentStep: result.status === "settled" || result.status === "sent" ? "settled" : result.status === "failed" || result.status === "pending" ? "failed" : m.paymentStep,
        ...hspFields,
      }));

      if (result.status === "signing" || result.status === "sent") {
        startPolling(result.id, message.id);
      } else if (result.status === "settled" && (result.hspVerified === true || !("viaHsp" in result) || !result.viaHsp)) {
        if (!confettiFiredRef.current.has(message.id)) {
          confettiFiredRef.current.add(message.id);
          firePaymentConfetti();
        }
      }
    },
    [isConnected, open, settle, chainId, ensureSession, startPolling, t, ccipBridge],
  );

  const handleCancel = useCallback(
    (message: ChatMessageData) => {
      const sid = activeId ?? ensureSession();
      useChatStore.getState().updateMessage(sid, message.id, (m) => ({
        ...m,
        status: undefined,
        intent: undefined,
        paymentId: undefined,
        txHash: undefined,
        chainId: undefined,
      }));
    },
    [activeId, ensureSession],
  );

  const handleAnchor = useCallback(
    async (message: ChatMessageData) => {
      if (!message.paymentId) return;
      const sid = activeId ?? ensureSession();

      useChatStore.getState().updateMessage(sid, message.id, (m) => ({
        ...m,
        isAnchoring: true,
        anchorError: null,
      }));

      try {
        const result = await anchor(message.paymentId);

        if (result.status === "anchored") {
          useChatStore.getState().updateMessage(sid, message.id, (m) => ({
            ...m,
            isAnchoring: false,
            anchored: {
              txHash: result.anchorTxHash,
              alreadyExisted: result.alreadyExisted,
            },
            anchorError: null,
          }));
          useChatStore.getState().addMessage(
            sid,
            newMessage(
              "assistant",
              result.alreadyExisted
                ? t("chat.alreadyAnchored")
                : `${t("chat.anchorRecorded")}${result.anchorTxHash ? ` — [view on explorer](${explorerTxUrl(177, result.anchorTxHash)})` : ""}`,
            ),
          );
        } else if (result.status === "declined") {
          useChatStore.getState().updateMessage(sid, message.id, (m) => ({
            ...m,
            isAnchoring: false,
          }));
        } else {
          const errMsg = result.error?.includes("not found")
            ? t("payments.anchorNotFound")
            : result.error;
          useChatStore.getState().updateMessage(sid, message.id, (m) => ({
            ...m,
            isAnchoring: false,
            anchorError: errMsg,
          }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Anchor failed.";
        useChatStore.getState().updateMessage(sid, message.id, (m) => ({
          ...m,
          isAnchoring: false,
          anchorError: msg,
        }));
      }
    },
    [activeId, ensureSession, anchor, t],
  );

  const handleCopyMessage = useCallback((_message: ChatMessageData) => {}, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const handleEditMessage = useCallback((message: ChatMessageData) => {
    if (message.role !== "user") return;
    setEditingPrefill(message.content);
    setEditingMessageId(message.id);
    const sid = activeId ?? ensureSession();
    const msgs = useChatStore.getState().sessions[sid]?.messages ?? [];
    const idx = msgs.findIndex((m) => m.id === message.id);
    if (idx >= 0) {
      for (let i = msgs.length - 1; i > idx; i--) {
        useChatStore.getState().deleteMessage(sid, msgs[i].id);
      }
    }
  }, [activeId, ensureSession, setEditingPrefill, setEditingMessageId]);

  const handleDeleteMessage = useCallback((message: ChatMessageData) => {
    const sid = activeId ?? ensureSession();
    useChatStore.getState().deleteMessage(sid, message.id);
  }, [activeId, ensureSession]);

  const isEmpty = messages.length === 0 && !isThinking;

  const sortedSessions = useMemo(() => order.map((id) => sessions[id]).filter(Boolean), [order, sessions]);

  const commitRename = (id: string) => {
    const t = draftTitle.trim();
    if (t) renameChat(id, t);
    setEditingId(null);
  };

  if (!mounted) {
    return (
      <div className="relative flex h-full">
        <div className="relative flex h-full flex-1 flex-col">
          <div className="flex-1" />
          <div className="border-t border-border bg-transparent">
            <div className="mx-auto w-full max-w-2xl px-4 pt-[68px] pb-3 sm:px-6 sm:pt-[76px]">
              <div className="flex items-end gap-2">
                <div className="flex-1 h-[52px] rounded-2xl bg-surface-2/30 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full">
      <ChatSidebar
        sessions={sortedSessions}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={(id) => {
          selectChat(id);
          setSidebarOpen(false);
        }}
        onNew={() => {
          newChat();
          setSidebarOpen(false);
        }}
        onDelete={deleteChat}
        editingId={editingId}
        draftTitle={draftTitle}
        onEditStart={(s) => {
          setEditingId(s.id);
          setDraftTitle(s.title);
        }}
        onDraftChange={setDraftTitle}
        onDraftCommit={commitRename}
        onDraftCancel={() => setEditingId(null)}
      />

      <div className="relative flex h-full flex-1 flex-col">
        <div className="absolute inset-0 pointer-events-none">
          <ShootingStars className="absolute inset-0 w-full h-full" />
          <StarsBackground className="absolute inset-0 w-full h-full" />
        </div>

        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="absolute left-3 top-[68px] z-20 flex h-9 w-9 items-center justify-center rounded-xl glass-tight text-muted hover:text-foreground sm:hidden"
          aria-label={t("chat.openSidebar")}
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10">
          <div className="mx-auto w-full max-w-2xl px-4 pt-[68px] pb-6 sm:px-6 sm:pt-[76px]">
            <AnimatePresence mode="wait">
              {isEmpty ? (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <WelcomeState />
                </motion.div>
              ) : (
                <div className="flex flex-col gap-4">
                  <AnimatePresence initial={false}>
                    {messages.map((m) => (
                      <ChatMessage
                        key={m.id}
                        message={m}
                        onConfirmIntent={handleConfirm}
                        onCancelIntent={handleCancel}
                        onCancelPayment={handleCancelPayment}
                        onAnchor={canAnchor ? handleAnchor : undefined}
                        onCopy={handleCopyMessage}
                        onEdit={handleEditMessage}
                        onDelete={handleDeleteMessage}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </AnimatePresence>
            <div ref={bottomRef} className="h-1" />
          </div>
        </div>

        <div className="border-t border-border/30 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-2xl px-4 py-3 sm:px-6">
            <div className="relative z-30 mb-1.5">
              <ModelPicker
                config={config}
                activeSessionId={activeId}
                modelOverride={activeSession?.modelOverride ?? null}
                onOverride={setChatModelOverride}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ChatInput onSend={handleSend} disabled={isThinking || isSettling} prefill={editingPrefill} onStop={handleStop} isGenerating={isThinking} />
              </div>
              <AiProviderButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SidebarProps {
  sessions: Array<{ id: string; title: string; updatedAt: number; messages: ChatMessageData[] }>;
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  editingId: string | null;
  draftTitle: string;
  onEditStart: (s: { id: string; title: string }) => void;
  onDraftChange: (v: string) => void;
  onDraftCommit: (id: string) => void;
  onDraftCancel: () => void;
}

function ChatSidebar({
  sessions, activeId, open, onClose, onSelect, onNew, onDelete, editingId, draftTitle,
  onEditStart, onDraftChange, onDraftCommit, onDraftCancel,
}: SidebarProps) {
  const { t } = useI18n();
  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm sm:hidden"
            aria-label={t("chat.closeSidebar")}
          />
        ) : null}
      </AnimatePresence>

      <aside
        className={cn(
          "absolute left-0 top-0 z-40 flex h-full w-72 flex-col border-r border-border bg-black/80 backdrop-blur-xl pt-2 transition-transform duration-300 sm:relative sm:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full sm:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-[68px] pb-4 sm:pt-[76px]">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MessageSquare className="h-4 w-4 text-primary" /> {t("chat.chats")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-white/10 hover:text-foreground sm:hidden"
            aria-label={t("chat.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3">
          <button
            type="button"
            onClick={onNew}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-white/5 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
          >
            <Plus className="h-4 w-4" /> {t("chat.newChat")}
          </button>
        </div>

        <div className="mt-2 flex-1 overflow-y-auto px-2 pb-4">
          {sessions.map((s) => {
            const isActive = s.id === activeId;
            return (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors",
                  isActive ? "bg-white/10 text-foreground" : "text-muted hover:bg-white/5 hover:text-foreground",
                )}
              >
                <button type="button" onClick={() => onSelect(s.id)} className="flex-1 truncate text-left">
                  {editingId === s.id ? (
                    <input
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => onDraftChange(e.target.value)}
                      onBlur={() => onDraftCommit(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onDraftCommit(s.id);
                        if (e.key === "Escape") onDraftCancel();
                      }}
                      className="w-full rounded bg-surface-2/50 px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                    />
                  ) : (
                    <span className="block truncate">{s.title || t("chat.newChat")}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onEditStart(s)}
                  className="hidden h-6 w-6 items-center justify-center rounded text-muted hover:bg-white/10 hover:text-foreground group-hover:flex"
                  aria-label={t("chat.renameChat")}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  className="hidden h-6 w-6 items-center justify-center rounded text-muted hover:bg-danger/15 hover:text-danger group-hover:flex"
                  aria-label={t("chat.deleteChat")}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

const WelcomeState = memo(function WelcomeState() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 text-center sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-2"
      >
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          <Wordmark className="text-2xl sm:text-3xl" />
        </h1>
        <p className="max-w-sm text-[15px] leading-relaxed text-muted">
          {t("chat.welcomeDesc")}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass-tight flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-muted"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {t("app.poweredBy")}
      </motion.div>
    </div>
  );
});
