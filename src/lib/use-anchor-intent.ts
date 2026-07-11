"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useSendTransaction, useSwitchChain } from "wagmi";
import {
  type Address,
  type Hash,
  type Hex,
  createPublicClient,
  encodeFunctionData,
  encodePacked,
  getAddress,
  http,
  keccak256,
  toHex,
} from "viem";
import { INTENT_ANCHOR_ABI, INTENT_ANCHOR_BYTECODE } from "@/lib/anchors/anchor-bytecode";
import {
  INTENT_ANCHOR_ADDRESS,
  INTENT_ANCHOR_CHAIN_ID,
  isAnchorConfigured,
} from "@/lib/anchors/config";
import { getChainByChainId } from "@/lib/chains";
import { useUpdatePayment } from "@/lib/api";
import type { Payment } from "@/lib/api";

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const UINT128_MAX = (1n << 128n) - 1n;
const UINT64_MAX = (1n << 64n) - 1n;

export type AnchorResult =
  | { status: "anchored"; anchorTxHash: string | null; alreadyExisted?: boolean }
  | { status: "failed"; error: string }
  | { status: "declined"; reason: string };

async function fetchPayment(id: string): Promise<Payment | null> {
  try {
    const res = await fetch(`/api/payments/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { payment: Payment };
    return data.payment ?? null;
  } catch {
    return null;
  }
}

function isBytes32(v: string | null | undefined): v is Hash {
  return !!v && /^0x[0-9a-fA-F]{64}$/.test(v);
}

function intentHashFor(p: Payment): Hash {
  if (isBytes32(p.hspPaymentId)) return p.hspPaymentId;
  if (isBytes32(p.txHash)) {
    return keccak256(encodePacked(["uint256", "bytes32"], [BigInt(p.chainId), p.txHash as Hex]));
  }
  return keccak256(toHex(p.id, { size: 32 }));
}

function hspPaymentIdFor(p: Payment): Hex {
  return isBytes32(p.hspPaymentId) ? p.hspPaymentId : ZERO_BYTES32;
}

export function useAnchorIntent() {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const updatePayment = useUpdatePayment();
  const [isAnchoring, setIsAnchoring] = useState(false);

  const anchor = useCallback(
    async (paymentId: string): Promise<AnchorResult> => {
      if (!isAnchorConfigured()) {
        return { status: "failed", error: "Anchor contract not configured." };
      }
      if (!isConnected || !address) {
        return { status: "declined", reason: "no-wallet" };
      }

      const p = await fetchPayment(paymentId);
      if (!p) {
        return { status: "failed", error: "Payment record not found. The payment may have been deleted or not yet created." };
      }

      let amount: bigint;
      try {
        amount = BigInt(p.amountBaseUnits);
      } catch {
        return { status: "failed", error: "Invalid amount." };
      }
      if (amount > UINT128_MAX) {
        return { status: "failed", error: "Amount exceeds uint128." };
      }
      if (BigInt(p.chainId) > UINT64_MAX) {
        return { status: "failed", error: "Chain id exceeds uint64." };
      }

      const intentHash = intentHashFor(p);
      const hspPaymentIdArg = hspPaymentIdFor(p);

      const cfg = getChainByChainId(INTENT_ANCHOR_CHAIN_ID);
      const reader = cfg
        ? createPublicClient({ transport: http(cfg.rpcUrl) })
        : publicClient;

      try {
        if (reader) {
          const existing = (await reader.readContract({
            address: INTENT_ANCHOR_ADDRESS,
            abi: INTENT_ANCHOR_ABI,
            functionName: "anchors",
            args: [intentHash],
          })) as readonly [Address, Address, bigint, bigint, bigint, Hex, Hex];

          if (existing[0].length === 42 && existing[0].toLowerCase() !== ZERO_ADDRESS) {
            setIsAnchoring(true);
            try {
              await updatePayment.mutateAsync({
                id: p.id,
                anchorIntentHash: intentHash,
                anchorChainId: INTENT_ANCHOR_CHAIN_ID,
                anchorHspPaymentId: hspPaymentIdArg === ZERO_BYTES32 ? null : hspPaymentIdArg,
                anchoredAt: Date.now(),
              });
            } catch {
              // DB update non-critical
            } finally {
              setIsAnchoring(false);
            }
            return { status: "anchored", anchorTxHash: null, alreadyExisted: true };
          }
        }
      } catch {
        // read failed — proceed to attempt the on-chain anchor
      }

      const data = encodeFunctionData({
        abi: INTENT_ANCHOR_ABI,
        functionName: "anchorIntent",
        args: [intentHash, getAddress(p.recipientAddress), amount, BigInt(p.chainId), hspPaymentIdArg],
      });

      setIsAnchoring(true);
      try {
        const effectiveChainId = INTENT_ANCHOR_CHAIN_ID;

        if (walletChainId && walletChainId !== effectiveChainId) {
          try {
            const switchTimeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Chain switch timed out. Please approve the switch in your wallet.")), 60_000),
            );
            await Promise.race([switchChainAsync({ chainId: effectiveChainId }), switchTimeout]);
          } catch (switchErr: unknown) {
            const msg = switchErr instanceof Error ? switchErr.message : "";
            if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected") || msg.includes("timed out")) {
              return { status: "declined", reason: msg };
            }
            throw switchErr;
          }
        }

        const mainnetClient = createPublicClient({
          transport: http(getChainByChainId(effectiveChainId)?.rpcUrl),
        });

        let txHash: string;
        try {
          const txTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Transaction timed out. Please approve the transaction in your wallet.")), 120_000),
          );
          txHash = await Promise.race([
            sendTransactionAsync({
              to: INTENT_ANCHOR_ADDRESS,
              data,
              chainId: effectiveChainId,
            } as Parameters<typeof sendTransactionAsync>[0]),
            txTimeout,
          ]);
        } catch (txErr: unknown) {
          const msg = txErr instanceof Error ? txErr.message : "";
          if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected") || msg.includes("timed out")) {
            return { status: "declined", reason: "Anchor rejected by user" };
          }
          throw txErr;
        }

        const receiptTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Receipt timeout — transaction may still be pending. Check the explorer.")), 120_000),
        );
        const receipt = await Promise.race([
          mainnetClient.waitForTransactionReceipt({
            hash: txHash as Hash,
            confirmations: 1,
          }),
          receiptTimeout,
        ]);

        if (receipt && receipt.status === "success") {
          try {
            await updatePayment.mutateAsync({
              id: p.id,
              anchorIntentHash: intentHash,
              anchorTxHash: txHash,
              anchorChainId: INTENT_ANCHOR_CHAIN_ID,
              anchorHspPaymentId: hspPaymentIdArg === ZERO_BYTES32 ? null : hspPaymentIdArg,
              anchoredAt: Date.now(),
            });
          } catch {
            // DB update non-critical — on-chain anchor is the source of truth
          }
          return { status: "anchored", anchorTxHash: txHash, alreadyExisted: false };
        }

        let alreadyAnchoredByOther = false;
        try {
          if (reader) {
            const existing = (await reader.readContract({
              address: INTENT_ANCHOR_ADDRESS,
              abi: INTENT_ANCHOR_ABI,
              functionName: "anchors",
              args: [intentHash],
            })) as readonly [Address, Address, bigint, bigint, bigint, Hex, Hex];
            alreadyAnchoredByOther =
              existing[0].length === 42 && existing[0].toLowerCase() !== ZERO_ADDRESS;
          }
        } catch {
          alreadyAnchoredByOther = false;
        }

        if (alreadyAnchoredByOther) {
          try {
            await updatePayment.mutateAsync({
              id: p.id,
              anchorIntentHash: intentHash,
              anchorChainId: INTENT_ANCHOR_CHAIN_ID,
              anchorHspPaymentId: hspPaymentIdArg === ZERO_BYTES32 ? null : hspPaymentIdArg,
              anchoredAt: Date.now(),
            });
          } catch {
            // DB update non-critical
          }
          return { status: "anchored", anchorTxHash: null, alreadyExisted: true };
        }

        return { status: "failed", error: "On-chain anchor reverted" };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Anchor failed.";
        if (message.includes("rejected") || message.includes("denied")) {
          return { status: "declined", reason: message };
        }
        return { status: "failed", error: message };
      } finally {
        setIsAnchoring(false);
      }
    },
    [address, isConnected, walletChainId, switchChainAsync, sendTransactionAsync, updatePayment, publicClient],
  );

  return { anchor, isAnchoring, canAnchor: isAnchorConfigured() };
}

export { INTENT_ANCHOR_BYTECODE };
