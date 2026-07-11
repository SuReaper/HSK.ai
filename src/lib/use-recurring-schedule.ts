"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useSendTransaction, useSwitchChain } from "wagmi";
import {
  type Address,
  type Hash,
  createPublicClient,
  encodeFunctionData,
  encodePacked,
  getAddress,
  http,
  keccak256,
} from "viem";
import { RECURRING_ABI } from "@/lib/anchors/recurring-bytecode";
import {
  RECURRING_ADDRESS,
  RECURRING_CHAIN_ID,
  isRecurringConfigured,
} from "@/lib/anchors/recurring-config";
import { getChainByChainId } from "@/lib/chains";
import { useCreateRecurring, useUpdateRecurring } from "@/lib/api";
import type { CreateRecurringPayload } from "@/lib/api";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type RegisterResult =
  | { status: "registered"; txHash: string | null; alreadyExisted?: boolean }
  | { status: "failed"; error: string }
  | { status: "declined"; reason: string };

export type CancelResult =
  | { status: "cancelled"; txHash: string }
  | { status: "failed"; error: string }
  | { status: "declined"; reason: string };

export interface RegisterScheduleInput {
  recipientAddress: string;
  tokenAddress: string;
  amountBaseUnits: string;
  amountHuman: string;
  cadence: number;
  firstFireAt: number;
  maxExecutions: number;
  recipientLabel?: string | null;
  token?: string;
}

function deriveScheduleId(
  author: Address,
  recipient: Address,
  token: Address,
  amount: bigint,
  cadence: number,
  firstFireAt: number,
): Hash {
  return keccak256(
    encodePacked(
      ["address", "address", "address", "uint128", "uint8", "uint64"],
      [author, recipient, token, amount, cadence, BigInt(firstFireAt)] as const,
    ),
  );
}

export function useRecurringSchedule() {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const createRecurring = useCreateRecurring();
  const updateRecurring = useUpdateRecurring();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const register = useCallback(
    async (input: RegisterScheduleInput): Promise<RegisterResult> => {
      if (!isRecurringConfigured()) {
        return { status: "failed", error: "Recurring contract not configured." };
      }
      if (!isConnected || !address) {
        return { status: "declined", reason: "no-wallet" };
      }

      let amount: bigint;
      try {
        amount = BigInt(input.amountBaseUnits);
      } catch {
        return { status: "failed", error: "Invalid amount." };
      }

      const recipient = getAddress(input.recipientAddress);
      const token = getAddress(input.tokenAddress);
      const scheduleId = deriveScheduleId(address, recipient, token, amount, input.cadence, input.firstFireAt);

      const cfg = getChainByChainId(RECURRING_CHAIN_ID);
      const reader = cfg ? createPublicClient({ transport: http(cfg.rpcUrl) }) : publicClient;

      try {
        if (reader) {
          const existing = (await reader.readContract({
            address: RECURRING_ADDRESS,
            abi: RECURRING_ABI,
            functionName: "schedules",
            args: [scheduleId],
          })) as readonly [Address, ...unknown[]];

          if (existing[0].length === 42 && existing[0].toLowerCase() !== ZERO_ADDRESS) {
            return { status: "registered", txHash: null, alreadyExisted: true };
          }
        }
      } catch {
        // read failed — proceed to attempt registration
      }

      const data = encodeFunctionData({
        abi: RECURRING_ABI,
        functionName: "registerSchedule",
        args: [scheduleId, recipient, token, amount, input.cadence, BigInt(input.firstFireAt), input.maxExecutions],
      });

      setIsRegistering(true);
      try {
        if (walletChainId && walletChainId !== RECURRING_CHAIN_ID) {
          try {
            const switchTimeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Chain switch timed out. Please approve the switch in your wallet.")), 60_000),
            );
            await Promise.race([switchChainAsync({ chainId: RECURRING_CHAIN_ID }), switchTimeout]);
          } catch (switchErr: unknown) {
            const msg = switchErr instanceof Error ? switchErr.message : "";
            if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected") || msg.includes("timed out")) {
              return { status: "declined", reason: msg };
            }
            throw switchErr;
          }
        }

        const mainnetClient = createPublicClient({
          transport: http(getChainByChainId(RECURRING_CHAIN_ID)?.rpcUrl),
        });

        let txHash: string;
        try {
          const txTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Transaction timed out. Please approve the transaction in your wallet.")), 120_000),
          );
          txHash = await Promise.race([
            sendTransactionAsync({
              to: RECURRING_ADDRESS,
              data,
              chainId: RECURRING_CHAIN_ID,
            } as Parameters<typeof sendTransactionAsync>[0]),
            txTimeout,
          ]);
        } catch (txErr: unknown) {
          const msg = txErr instanceof Error ? txErr.message : "";
          if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected") || msg.includes("timed out")) {
            return { status: "declined", reason: msg };
          }
          throw txErr;
        }

        const receiptTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Receipt timeout — transaction may still be pending.")), 120_000),
        );
        const receipt = await Promise.race([
          mainnetClient.waitForTransactionReceipt({
            hash: txHash as Hash,
            confirmations: 1,
          }),
          receiptTimeout,
        ]);

        if (receipt && receipt.status === "success") {
          const dbPayload: CreateRecurringPayload = {
            id: crypto.randomUUID(),
            recipientLabel: input.recipientLabel ?? null,
            recipientAddress: recipient,
            token: input.token ?? "USDC",
            tokenAddress: token,
            amountHuman: input.amountHuman,
            amountBaseUnits: input.amountBaseUnits,
            cadence: [undefined, "weekly", "biweekly", "monthly"][input.cadence] ?? "monthly",
            nextFireAt: input.firstFireAt,
            maxExecutions: input.maxExecutions,
            scheduleIdHash: scheduleId,
            anchorChainId: RECURRING_CHAIN_ID,
            anchorTxHash: txHash,
            senderAddress: address,
          };

          try {
            await createRecurring.mutateAsync(dbPayload);
          } catch {
            // DB write non-critical — on-chain is source of truth
          }

          return { status: "registered", txHash };
        }

        return { status: "failed", error: "On-chain registration reverted" };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Registration failed.";
        if (message.includes("rejected") || message.includes("denied")) {
          return { status: "declined", reason: message };
        }
        return { status: "failed", error: message };
      } finally {
        setIsRegistering(false);
      }
    },
    [address, isConnected, walletChainId, switchChainAsync, sendTransactionAsync, createRecurring, publicClient],
  );

  const cancel = useCallback(
    async (scheduleIdHash: string, dbId: string): Promise<CancelResult> => {
      if (!isRecurringConfigured()) {
        return { status: "failed", error: "Recurring contract not configured." };
      }
      if (!isConnected || !address) {
        return { status: "declined", reason: "no-wallet" };
      }

      const data = encodeFunctionData({
        abi: RECURRING_ABI,
        functionName: "cancelSchedule",
        args: [scheduleIdHash as Hash],
      });

      setIsCancelling(true);
      try {
        if (walletChainId && walletChainId !== RECURRING_CHAIN_ID) {
          try {
            await switchChainAsync({ chainId: RECURRING_CHAIN_ID });
          } catch (switchErr: unknown) {
            const msg = switchErr instanceof Error ? switchErr.message : "";
            if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected")) {
              return { status: "declined", reason: "Chain switch rejected by user" };
            }
            throw switchErr;
          }
        }

        const mainnetClient = createPublicClient({
          transport: http(getChainByChainId(RECURRING_CHAIN_ID)?.rpcUrl),
        });

        let txHash: string;
        try {
          txHash = await sendTransactionAsync({
            to: RECURRING_ADDRESS,
            data,
            chainId: RECURRING_CHAIN_ID,
          } as Parameters<typeof sendTransactionAsync>[0]);
        } catch (txErr: unknown) {
          const msg = txErr instanceof Error ? txErr.message : "";
          if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected")) {
            return { status: "declined", reason: "Cancel rejected by user" };
          }
          throw txErr;
        }

        const cancelTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Receipt timeout — transaction may still be pending.")), 120_000),
        );
        const receipt = await Promise.race([
          mainnetClient.waitForTransactionReceipt({
            hash: txHash as Hash,
            confirmations: 1,
          }),
          cancelTimeout,
        ]);

        if (receipt && receipt.status === "success") {
          try {
            await updateRecurring.mutateAsync({ id: dbId, active: false });
          } catch {
            // DB update non-critical
          }
          return { status: "cancelled", txHash };
        }

        return { status: "failed", error: "On-chain cancel reverted" };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Cancel failed.";
        if (message.includes("rejected") || message.includes("denied")) {
          return { status: "declined", reason: message };
        }
        return { status: "failed", error: message };
      } finally {
        setIsCancelling(false);
      }
    },
    [address, isConnected, walletChainId, switchChainAsync, sendTransactionAsync, updateRecurring],
  );

  return {
    register,
    cancel,
    isRegistering,
    isCancelling,
    canRegister: isRecurringConfigured(),
  };
}
