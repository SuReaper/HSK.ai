import { tool } from "ai";
import { z } from "zod";
import type { PaymentIntent } from "@/lib/types";
import { CCIP_DEST_CHAIN_DESCS } from "@/lib/ccip/dest-chains";

const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  "USDC.E": 6,
  USDT: 6,
  HSK: 18,
  ETH: 18,
  WETH: 18,
  WBTC: 8,
  DAI: 18,
  "CCIP-BnM": 18,
};

function toBaseUnits(amountHuman: string, decimals: number): string {
  const clean = amountHuman.trim();
  const neg = clean.startsWith("-");
  const digits = clean.replace(/[^0-9.]/g, "");
  const parts = digits.split(".");
  const integerPart = parts[0] || "0";
  const fractionalPart = (parts[1] ?? "").padEnd(decimals, "0").slice(0, decimals);
  const combined = BigInt(integerPart + fractionalPart || "0");
  return (neg ? "-" : "") + combined.toString();
}

/**
 * The only tool the assistant can call. When the user clearly wants to send a
 * payment, the model calls this and the server returns a structured intent that
 * the client renders as an IntentCard. The tool does NOT move any funds — it
 * only produces a reviewable intent.
 */
export const createIntentCardTool = tool({
  description:
    "Create a reviewable payment intent card. Call this ONLY when the user clearly requests to send or transfer funds. Extract the recipient, token, and amount from the conversation. The user will review the card and confirm before anything is sent. Do NOT call this for general questions, history, or explanations.",
  inputSchema: z.object({
    recipientLabel: z
      .string()
      .nullable()
      .describe("Resolved contact name if you can match one, otherwise null"),
    recipientAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 0x EVM address")
      .describe("0x wallet address of the recipient"),
    token: z
      .string()
      .describe("Token symbol to send, e.g. USDC, HSK, ETH"),
    amountHuman: z
      .string()
      .regex(/^\d+(?:\.\d{1,18})?$/, "Decimal amount string, e.g. '50' or '25.50'")
      .describe("Human-readable amount, e.g. '50' or '25.50'"),
    memo: z
      .string()
      .nullable()
      .describe("Optional payment note or reason, null if none"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe("Your confidence 0-1 that the intent matches the user request"),
    crossChain: z
      .object({
        destChainName: z
          .string()
          .describe(
            `Destination chain name if the user wants cross-chain via CCIP. One of: ${CCIP_DEST_CHAIN_DESCS}. Only set this when the user explicitly names a different chain.`,
          ),
        destChainId: z
          .number()
          .int()
          .positive()
          .describe("EVM chain ID of the destination chain"),
        destRecipientAddress: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 0x EVM address")
          .describe("Recipient address on the destination chain"),
        destTokenSymbol: z
          .string()
          .default("CCIP-BnM")
          .describe("Token symbol on the destination chain (CCIP-BnM for testnet cross-chain)"),
      })
      .optional()
      .describe("Cross-chain CCIP destination info. ONLY set when the user explicitly wants to send to a different chain."),
  }),
  execute: async ({
    recipientLabel,
    recipientAddress,
    token,
    amountHuman,
    memo,
    confidence,
    crossChain,
  }): Promise<{ ok: true; intent: PaymentIntent }> => {
    const tokenUpper = token.toUpperCase();
    const resolvedToken = Object.keys(TOKEN_DECIMALS).includes(tokenUpper)
      ? tokenUpper
      : token;
    const decimals = TOKEN_DECIMALS[resolvedToken] ?? 18;

    return {
      ok: true,
      intent: {
        recipientLabel: recipientLabel && recipientLabel.trim() ? recipientLabel.trim() : null,
        recipientAddress: recipientAddress as `0x${string}`,
        token: resolvedToken,
        amountHuman,
        amountBaseUnits: toBaseUnits(amountHuman, decimals),
        memo: memo && memo.trim() ? memo.trim() : null,
        requiresConfirmation: true,
        confidence,
        aiGenerated: true,
        ...(crossChain ? {
          crossChain: {
            destChainId: crossChain.destChainId,
            destChainName: crossChain.destChainName,
            destRecipientAddress: crossChain.destRecipientAddress as `0x${string}`,
            destTokenSymbol: crossChain.destTokenSymbol || "CCIP-BnM",
          },
        } : {}),
      },
    };
  },
});

export const intentTools = {
  create_intent_card: createIntentCardTool,
};

export type IntentToolName = keyof typeof intentTools;
