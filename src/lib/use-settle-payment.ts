"use client";

import { useCallback, useRef, useState } from "react";
import { decodeFunctionData, erc20Abi, type Address, type Hash, type Hex } from "viem";
import { useAccount, usePublicClient, useSendTransaction, useSignTypedData, useSwitchChain, useWriteContract } from "wagmi";
import { useCreatePayment, useUpdatePayment } from "@/lib/api";
import type { PaymentIntent } from "@/lib/types";
import type { Mandate } from "@hsp/core";
import { getChainByChainId } from "@/lib/chains";

function shortenAddr(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

/**
 * Enrich EIP-712 typed data message with human-readable string fields that
 * wallets render in the signature popup. These fields are NOT part of the
 * `types.Mandate` struct, so viem's `hashTypedData` / `validateTypedData`
 * completely ignore them — the cryptographic hash (and thus the signature)
 * is unchanged and remains valid for HSP coordinator verification.
 *
 * TitleCase keys render cleanly as labels in most EIP-712 wallets (Reown,
 * MetaMask, WalletConnect) and are visually distinct from the lowercase
 * protocol-typed fields (nonce, signer, token, amount, etc.).
 */
function enrichEip712Message(
  typedData: unknown,
  intent: PaymentIntent,
  recipientLabel: string | null,
  chainId: number,
): Record<string, unknown> & { domain: unknown; types: unknown; primaryType: string; message: Record<string, unknown> } {
  const td = { ...(typedData as Record<string, unknown>) } as {
    domain: unknown;
    types: unknown;
    primaryType: string;
    message: Record<string, unknown>;
  };
  td.message = {
    ...td.message,
    Payment: `${intent.amountHuman} ${intent.token} → ${recipientLabel ?? shortenAddr(intent.recipientAddress)}`,
    Recipient: recipientLabel
      ? `${recipientLabel} (${intent.recipientAddress})`
      : intent.recipientAddress,
    Network: networkLabel(chainId),
    Memo: intent.memo ?? "",
    Note: "Free signature — no gas, no tokens move. Confirm the transfer after this.",
  };
  return td;
}

function networkLabel(chainId: number): string {
  switch (chainId) {
    case 133:
      return "HashKey Chain Testnet";
    case 1:
      return "Ethereum Mainnet";
    default:
      return `Chain ${chainId}`;
  }
}

export type StepContext = {
  viaHsp?: boolean;
  hspPaymentId?: string | null;
  txHash?: string | null;
};

export type SettleResult =
  | {
      id: string;
      status: "settled";
      txHash: string;
      viaHsp: boolean;
      hspStatus?: string | null;
      hspVerified?: boolean | null;
      hspDecision?: string | null;
      hspPaymentId?: string | null;
    }
  | {
      id: string;
      status: "sent";
      txHash: string;
      viaHsp: true;
      hspStatus?: string | null;
      hspVerified?: boolean | null;
      hspDecision?: string | null;
      hspPaymentId?: string | null;
    }
  | {
      id: string;
      status: "failed";
      txHash?: string;
      error: string;
      viaHsp?: boolean;
    }
  | {
      id: string;
      status: "signing";
      txHash?: string;
      viaHsp?: boolean;
    }
  | {
      id: string;
      status: "pending";
      reason: "no-wallet" | "no-token" | "transfer-declined" | "mandate-declined";
      error?: string;
    };

interface PrepareResponse {
  paymentId?: Hex;
  mandateBody?: Mandate;
  typedData?: unknown;
  settleTx?: { to: Hex; data: Hex; chainId: number };
  error?: string;
}

interface RegisterResponse {
  ok?: boolean;
  error?: string;
  hspPaymentId?: Hex;
}

interface SubmitResponse {
  hspStatus?: string;
  hspVerified?: boolean;
  hspDecision?: string;
  status?: string;
  txHash?: Hex;
  error?: string;
}

export function useSettlePayment() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();
  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const [isSettling, setIsSettling] = useState(false);
  const cancelRef = useRef(false);

  const settle = useCallback(
    async (
      intent: PaymentIntent,
      onStep?: (step: string, ctx?: StepContext) => void,
    ): Promise<SettleResult> => {
      setIsSettling(true);
      cancelRef.current = false;
      let createdId: string | null = null;

      try {
        if (!isConnected || !address || !chainId) {
          return { id: "", status: "pending", reason: "no-wallet" };
        }

        const isStablecoinToken = intent.token === "USDC" || intent.token === "USDC.e";
        const isNativeToken = intent.token === "HSK" || intent.token === "ETH";

        /**
         * HSP verifiable settlement ONLY runs on HashKey Chain Testnet (chain 133).
         * The HSP sandbox coordinator (hsp-hackathon.hashkeymerchant.com) requires
         * the mandate, on-chain transfer, and observe all happen on chain 133.
         * If the wallet is on mainnet (177) and the user wants HSP, force-switch
         * to testnet before proceeding. Native-token transfers bypass HSP and
         * use the wallet's actual chain.
         */
        const useHsp = isStablecoinToken && !isNativeToken;
        let effectiveChainId = chainId;

        if (useHsp && chainId !== 133) {
          try {
            await switchChainAsync({ chainId: 133 });
            effectiveChainId = 133;
          } catch (switchErr) {
            const msg = switchErr instanceof Error ? switchErr.message : "network switch failed";
            return { id: "", status: "failed", error: `HSP requires testnet (133). Network switch rejected: ${msg}` };
          }
        }

        const chainConfig = getChainByChainId(effectiveChainId);
        if (!chainConfig) {
          return { id: "", status: "failed", error: `Unsupported chain ID ${effectiveChainId}` };
        }

        onStep?.("creating");

        const created = await createPayment.mutateAsync({
          recipientAddress: intent.recipientAddress,
          recipientLabel: intent.recipientLabel,
          token: intent.token,
          tokenAddress: intent.token !== "USDC" && intent.token !== "USDC.e" ? (intent.token as `0x${string}`) : null,
          amountHuman: intent.amountHuman,
          memo: intent.memo ?? null,
          chainId: effectiveChainId,
          senderAddress: address,
        });
        createdId = created.id;

        const erc20TokenAddress: Address =
          intent.token !== "USDC" && intent.token !== "USDC.e" && !isNativeToken
            ? (intent.token as Address)
            : chainConfig.stablecoin.address;

        // ---- HSP phase (ERC-20 stablecoins only) ----
        let viaHsp = false;
        let hspPaymentId: Hex | null = null;
        let mandateBody: Mandate | null = null;
        let signedMandate: Hex | null = null;
        let settleTx: { to: Hex; data: Hex } | null = null;

        // Skip HSP entirely for native tokens — it only supports ERC-20 transfers.
        if (!isNativeToken) {
          try {
            onStep?.("preparing");

            const response = await fetch("/api/hsp/prepare", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ dbPaymentId: created.id, chainId: effectiveChainId }),
            });
            const prepare: PrepareResponse = await response.json();

            if (
              response.ok &&
              prepare.paymentId &&
              prepare.mandateBody &&
              prepare.typedData &&
              prepare.settleTx
            ) {
              hspPaymentId = prepare.paymentId;
              mandateBody = prepare.mandateBody;
              settleTx = { to: prepare.settleTx.to, data: prepare.settleTx.data };

              await updatePayment.mutateAsync({ id: created.id, hspPaymentId, hspStatus: "PREPARING" });

              onStep?.("mandate-signing", { viaHsp: true, hspPaymentId });

              // Enrich the EIP-712 message with human-readable string fields.
              // These extra keys are NOT in types.Mandate, so viem's hashTypedData
              // ignores them entirely — the signature hash is unchanged and remains
              // valid for HSP coordinator verification. Wallets that render all
              // message keys will show these descriptive fields to the user.
              const enrichedTypedData = enrichEip712Message(
                prepare.typedData,
                intent,
                intent.recipientLabel,
                chainId!,
              );

              try {
                const signature = (await signTypedDataAsync(
                  enrichedTypedData as Parameters<typeof signTypedDataAsync>[0],
                )) as Hex;
                signedMandate = signature;
              } catch (signErr) {
                const msg = signErr instanceof Error ? signErr.message : "mandate sign failed";
                if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected")) {
                  await updatePayment.mutateAsync({ id: created.id, status: "failed" });
                  onStep?.("failed", { viaHsp: false });
                  return { id: created.id, status: "pending", reason: "mandate-declined", error: "Mandate signature rejected." };
                }
                throw signErr;
              }

              onStep?.("registering", { viaHsp: true, hspPaymentId });

              const registerRes = await fetch("/api/hsp/register", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dbPaymentId: created.id, paymentId: hspPaymentId, mandateBody, mandateSignature: signedMandate, chainId: effectiveChainId }),
              });
              const register: RegisterResponse = await registerRes.json();

              if (!registerRes.ok || !register.ok) {
                console.warn("[hsp] register rejected, falling back to plain transfer:", register.error);
                viaHsp = false;
                hspPaymentId = null;
                mandateBody = null;
                signedMandate = null;
                settleTx = null;
              } else {
                viaHsp = true;
              }
            }
          } catch (hspErr) {
            console.warn("[hsp] HSP prepare failed, falling back to plain transfer:", hspErr);
            viaHsp = false;
          }
        }

        await updatePayment.mutateAsync({
          id: created.id,
          status: "signing",
          ...(viaHsp && hspPaymentId ? { hspPaymentId } : {}),
          ...(viaHsp ? { hspStatus: "REGISTERED" } : {}),
        });

        onStep?.("transfer-signing", { viaHsp, hspPaymentId: viaHsp ? hspPaymentId : null });

        // Send the on-chain transfer.
        // Always use effectiveChainId — which is 133 (testnet) for HSP-eligible tokens.
        // This MUST match the chain the HSP mandate was registered on, otherwise
        // the coordinator cannot observe the transfer and settle will never reach SETTLED.
        let txHash: string;
        try {
          if (isNativeToken) {
            txHash = await sendTransactionAsync({
              to: intent.recipientAddress as Address,
              value: BigInt(intent.amountBaseUnits),
              chainId: effectiveChainId,
            });
          } else if (viaHsp && settleTx) {
            // Decode the server-encoded settleTx data for readable wallet display.
            // Decode in its own try/catch so wallet rejections from writeContractAsync
            // are NOT caught here (which would trigger a duplicate raw sendTransaction
            // popup). Only decode failures fall back to raw sendTransaction.
            let writeArgs: { functionName: string; args: readonly unknown[] } | null = null;
            try {
              const decoded = decodeFunctionData({ abi: erc20Abi, data: settleTx.data });
              writeArgs = { functionName: decoded.functionName, args: decoded.args };
            } catch {
              writeArgs = null;
            }
            if (writeArgs) {
              txHash = await writeContractAsync({
                address: settleTx.to as Address,
                abi: erc20Abi,
                functionName: writeArgs.functionName as "transfer",
                args: writeArgs.args as [Address, bigint],
                chainId: effectiveChainId,
              });
            } else {
              txHash = await sendTransactionAsync({ to: settleTx.to, data: settleTx.data, chainId: effectiveChainId });
            }
          } else {
            txHash = await writeContractAsync({
              address: erc20TokenAddress,
              abi: erc20Abi,
              functionName: "transfer",
              args: [intent.recipientAddress as Address, BigInt(intent.amountBaseUnits)],
              chainId: effectiveChainId,
            });
          }
        } catch (txErr) {
          const msg = txErr instanceof Error ? txErr.message : "Transaction failed";
          if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected")) {
            await updatePayment.mutateAsync({ id: created.id, status: "failed" });
            onStep?.("failed", { viaHsp });
            return { id: created.id, status: "pending", reason: "transfer-declined", error: "Transfer rejected by user." };
          }
          throw txErr;
        }

        await updatePayment.mutateAsync({
          id: created.id,
          status: "settling",
          txHash,
          ...(viaHsp ? { hspStatus: "OBSERVING" } : {}),
        });

        // Fire the txHash to the UI immediately so the user sees the transaction
        // info (explorer link, step timeline) without waiting for confirmation.
        // Then immediately start HSP observe in parallel with on-chain confirmation
        // — matching the official SDK flow: broadcast → observe (no receipt wait
        // before observing, since the coordinator waits for chain confirmations).
        if (viaHsp && hspPaymentId && mandateBody && signedMandate) {
          onStep?.("observing", { viaHsp: true, hspPaymentId, txHash });
        }
        onStep?.("confirming", { viaHsp, hspPaymentId: viaHsp ? hspPaymentId : null, txHash });

        const hspSubmitPromise =
          viaHsp && hspPaymentId && mandateBody && signedMandate
            ? (async () => {
                try {
                  const resp = await fetch("/api/hsp/submit", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ dbPaymentId: created.id, paymentId: hspPaymentId, mandateBody, mandateSignature: signedMandate, txHash: txHash as Hex, chainId: effectiveChainId }),
                  });
                  const submit: SubmitResponse = await resp.json();
                  await updatePayment.mutateAsync({
                    id: created.id,
                    hspStatus: submit.hspStatus ?? null,
                    hspVerified: submit.hspVerified ?? null,
                    hspDecision: submit.hspDecision ?? null,
                  });
                  return submit;
                } catch (submitErr) {
                  console.warn("[hsp] submit/observe failed (payment still settled on-chain):", submitErr);
                  return null;
                }
              })()
            : Promise.resolve<SubmitResponse | null>(null);

        // Wait for on-chain confirmation in parallel with HSP observe.
        // Used only for the revert check — HSP settle status comes from hspSubmitPromise.
        let onChainOk = true;
        if (publicClient) {
          try {
            const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as Hash, confirmations: 1 });
            onChainOk = receipt.status === "success";
          } catch {
            // Receipt timed out — tx may still be pending. Don't fail outright;
            // HSP observe may still complete. Return "signing" for polling fallback.
            return { id: created.id, status: "signing", txHash, ...(viaHsp ? { viaHsp } : {}) };
          }
        }

        // Check for on-chain revert after waiting.
        if (!onChainOk) {
          await updatePayment.mutateAsync({ id: created.id, status: "failed", txHash });
          onStep?.("failed", { viaHsp });
          return { id: created.id, status: "failed", txHash, error: "Transaction reverted on-chain." };
        }

        if (cancelRef.current) {
          onStep?.("failed", { viaHsp });
          return { id: created.id, status: "failed", txHash, error: "Payment cancelled by user." };
        }

        // Wait for HSP observe to finish (it was started in parallel above).
        const hspResult = await hspSubmitPromise;

        if (viaHsp && hspResult) {
          // HSP path: the submit route already set status (settled/sent) in the DB.
          // Return the actual HSP status to the caller so the UI reflects verification.
          const hspOk = hspResult.hspStatus === "SETTLED" && hspResult.hspVerified;
          onStep?.("settled", { viaHsp: true, hspPaymentId, txHash });
          if (hspOk) {
            return {
              id: created.id,
              status: "settled",
              txHash,
              viaHsp: true,
              hspStatus: hspResult.hspStatus ?? null,
              hspVerified: hspResult.hspVerified ?? null,
              hspDecision: hspResult.hspDecision ?? null,
              hspPaymentId,
            };
          }
          return {
            id: created.id,
            status: "sent",
            txHash,
            viaHsp: true,
            hspStatus: hspResult.hspStatus ?? null,
            hspVerified: hspResult.hspVerified ?? null,
            hspDecision: hspResult.hspDecision ?? null,
            hspPaymentId,
          };
        }

        // Non-HSP path: the DB was never updated to "settled" — do it now.
        await updatePayment.mutateAsync({ id: created.id, status: "settled", txHash });
        onStep?.("settled", { viaHsp, txHash });
        return { id: created.id, status: "settled", txHash, viaHsp };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Settlement failed.";
        if (createdId) {
          await updatePayment.mutateAsync({ id: createdId, status: "failed" });
        }
        onStep?.("failed");
        return { id: createdId ?? "", status: "failed", error: message };
      } finally {
        setIsSettling(false);
      }
    },
    [address, chainId, isConnected, publicClient, sendTransactionAsync, writeContractAsync, signTypedDataAsync, switchChainAsync, createPayment, updatePayment],
  );

  const cancelSettlement = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return { settle, isSettling, cancelSettlement };
}
