import { streamText, isStepCount } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { intentTools } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import type { PaymentIntent } from "@/lib/types";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface ProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  showThinking?: boolean;
}

interface WalletContext {
  address?: string | null;
  chainId?: number | null;
  holdings?: Record<string, { address: string | null; balance: string }> | null;
}

function sendLine(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, payload: Record<string, unknown>) {
  controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
}

/** Reasoning models (OpenAI o-series, DeepSeek-R, etc.) consume output budget on reasoning. */
function isReasoningModel(model: string): boolean {
  const m = model.toLowerCase();
  return /^o[0-9]/.test(m) || /o1-mini|o3-mini|o4-mini/.test(m) || /reason/.test(m) || /(^|[-_])r1/.test(m) || /deepseek-r/.test(m);
}

/** Resolve a safe output token budget. Reasoning models need a large budget or tool args get truncated. */
function resolveMaxTokens(model: string, configured?: number | null): number {
  if (isReasoningModel(model)) {
    const floor = 16000;
    if (!configured || configured < floor) {
      console.log(`[chat] reasoning model "${model}": bumping maxTokens ${configured ?? "unset"} -> ${floor} (reasoning eats output budget)`);
      return floor;
    }
    return configured;
  }
  if (!configured) return 4096;
  return configured;
}

export async function POST(req: Request) {
  let body: {
    messages: IncomingMessage[];
    providerConfig: ProviderConfig;
    wallet?: WalletContext | null;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body", code: "bad-request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { messages, providerConfig, wallet } = body;

  if (!providerConfig?.apiKey) {
    return new Response(
      JSON.stringify({
        error: "AI provider not configured. Set your API key in Chat Settings.",
        code: "no-api-key",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const apiKey = providerConfig.apiKey;
  const baseUrl = providerConfig.baseUrl || "https://api.openai.com/v1";
  const model = providerConfig.model || "gpt-4o";
  const reasoning = isReasoningModel(model);

  const openai = createOpenAI({ baseURL: baseUrl, apiKey });
  const systemPrompt = buildSystemPrompt(wallet ?? null);

  console.log("[chat] request:", {
    model,
    baseUrl,
    reasoningModel: reasoning,
    toolNames: Object.keys(intentTools),
    messageCount: messages.length,
    lastUserMessage: messages[messages.length - 1]?.content?.slice(0, 120),
    maxTokens: resolveMaxTokens(model, providerConfig.maxTokens ?? null),
  });

  const useChatApi = (() => {
    try {
      const u = new URL(baseUrl);
      // OpenAI's responses API only exists on api.openai.com. Every proxy /
      // third-party gateway implements /v1/chat/completions instead, and feeding
      // chat-style tool-call SSE through the responses adapter causes tool args
      // to stream forever without ever completing. Default to chat completions.
      return u.host !== "api.openai.com";
    } catch {
      return false;
    }
  })();

  console.log("[chat] usingResponsesApi:", !useChatApi, "host:", (() => { try { return new URL(baseUrl).host; } catch { return "?"; } })());

  const modelInstance = useChatApi ? openai.chat(model) : openai(model);

  const result = streamText({
    model: modelInstance,
    system: systemPrompt,
    temperature: reasoning ? undefined : providerConfig.temperature,
    topP: reasoning ? undefined : providerConfig.topP,
    maxOutputTokens: resolveMaxTokens(model, providerConfig.maxTokens ?? null),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: intentTools,
    toolChoice: "auto",
    // One model step: the model calls create_intent_card, the tool runs, we stop.
    // (Default squeezing-in a second "Please review…" generation is wasteful.)
    stopWhen: isStepCount(1),
    maxRetries: 2,
    includeRawChunks: true,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const saw = {
        toolCall: false,
        toolResult: false,
        toolInputDeltas: 0,
        toolInputEnded: false,
        finishReason: "",
        rawFinishReason: undefined as string | undefined,
      };
      try {
        for await (const part of result.stream) {
          switch (part.type) {
            case "reasoning-delta": {
              sendLine(controller, encoder, { type: "reasoning", text: part.text });
              break;
            }
            case "text-delta": {
              sendLine(controller, encoder, { type: "text", text: part.text });
              break;
            }
            case "raw": {
              // Chat-completions proxies (kimi, deepseek, …) stream the model's
              // thinking in delta.reasoning_content, which @ai-sdk/openai's chat
              // adapter ignores. Capture it here so the "Thinking" block shows up.
              const rv = part.rawValue as Record<string, unknown> | null;
              if (rv && typeof rv === "object") {
                const choices = (rv as { choices?: Array<{ delta?: { reasoning_content?: string } }> }).choices;
                const rc = choices?.[0]?.delta?.reasoning_content;
                if (typeof rc === "string" && rc.length > 0) {
                  sendLine(controller, encoder, { type: "reasoning", text: rc });
                }
              }
              break;
            }
            case "tool-input-start":
              console.log("[chat] tool-input-start:", "toolName" in part ? part.toolName : "?", "id" in part ? part.id : "");
              break;
            case "tool-input-delta":
              saw.toolInputDeltas += 1;
              break;
            case "tool-input-end":
              saw.toolInputEnded = true;
              console.log("[chat] tool-input-end:", "id" in part ? part.id : "");
              break;
            case "tool-call": {
              saw.toolCall = true;
              console.log("[chat] TOOL-CALL:", part.toolName, "input:", JSON.stringify("input" in part ? part.input : undefined)?.slice(0, 300));
              if (part.toolName === "create_intent_card") {
                sendLine(controller, encoder, {
                  type: "tool_start",
                  toolName: "create_intent_card",
                  input: "input" in part ? part.input : null,
                });
              }
              break;
            }
            case "tool-result": {
              saw.toolResult = true;
              console.log("[chat] TOOL-RESULT:", part.toolName, "output:", JSON.stringify("output" in part ? part.output : undefined)?.slice(0, 300));
              if (part.toolName === "create_intent_card") {
                const out = (part.output as { ok?: boolean; intent?: PaymentIntent } | null) ?? null;
                if (out?.ok && out.intent) {
                  sendLine(controller, encoder, { type: "intent", intent: out.intent });
                } else {
                  sendLine(controller, encoder, {
                    type: "debug",
                    msg: "tool returned no intent",
                    output: JSON.stringify(out),
                  });
                }
              }
              break;
            }
            case "tool-error": {
              const txt = "error" in part && part.error instanceof Error
                ? part.error.message
                : JSON.stringify("error" in part ? part.error : part);
              console.log("[chat] TOOL-ERROR:", "toolName" in part ? part.toolName : "?", txt);
              sendLine(controller, encoder, { type: "debug", msg: "tool-error", error: txt });
              break;
            }
            case "finish-step": {
              console.log("[chat] finish-step:", part.finishReason, "raw:", part.rawFinishReason, "toolInputDeltas:", saw.toolInputDeltas, "toolCall:", saw.toolCall);
              sendLine(controller, encoder, { type: "debug", msg: "finish-step", finishReason: part.finishReason });
              break;
            }
            case "error": {
              const msg = part.error instanceof Error ? part.error.message : "stream error";
              console.log("[chat] STREAM-ERROR:", msg);
              sendLine(controller, encoder, { type: "error", error: msg });
              break;
            }
            case "finish": {
              saw.finishReason = part.finishReason;
              saw.rawFinishReason = part.rawFinishReason;
              console.log("[chat] FINISH:", part.finishReason, "raw:", part.rawFinishReason, "toolCall:", saw.toolCall, "toolResult:", saw.toolResult);
              sendLine(controller, encoder, {
                type: "done",
                finishReason: part.finishReason,
                toolCalled: saw.toolCall,
                toolResult: saw.toolResult,
              });
              break;
            }
            default:
              break;
          }
        }
        if (!saw.toolCall) {
          const truncated =
            saw.toolInputDeltas > 0 && !saw.toolInputEnded && (saw.finishReason === "other" || saw.finishReason === "length");
          if (truncated) {
            console.log(
              `[chat] TRUNCATED tool call — model streamed ${saw.toolInputDeltas} arg deltas but never completed the tool call (finishReason=${saw.finishReason}). Likely cause: non-OpenAI endpoint hit via the responses API instead of chat completions, or output budget too small.`,
            );
            sendLine(controller, encoder, {
              type: "debug",
              msg: "truncated-tool-call",
              toolInputDeltas: saw.toolInputDeltas,
              usingChatApi: useChatApi,
              finishReason: saw.finishReason,
              hint:
                "Model started the tool call but didn't finalize it. For non-OpenAI hosts this means the responses API is being used wrongly (should be chat completions); for OpenAI reasoning models raise maxTokens.",
            });
          } else {
            console.log("[chat] NO TOOL CALL — model returned text only. finishReason:", saw.finishReason || "unknown");
            sendLine(controller, encoder, {
              type: "debug",
              msg: "no-tool-call",
              finishReason: saw.finishReason || "unknown",
              hint: "Model did not call create_intent_card. Check that the model supports tool/function calling and the baseURL endpoint supports tools.",
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream failed";
        console.log("[chat] STREAM-EXCEPTION:", msg, err);
        try { sendLine(controller, encoder, { type: "error", error: msg }); } catch {}
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
