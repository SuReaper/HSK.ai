"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useSendTransaction,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import {
  erc20Abi,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  type Address,
  type Hex,
  type Hash,
  maxUint256,
} from "viem";
import {
  CCIP_ROUTER_ABI,
  buildEvm2AnyMessage,
  buildExtraArgs,
} from "@/lib/ccip/router-abi";
import {
  ccipRouterAddress,
  isCcipConfigured,
} from "@/lib/ccip/config";
import {
  getDestChain,
  CCIP_EXPLORER_MESSAGE_URL,
  CCIP_SOURCE_CHAIN_ID,
} from "@/lib/ccip/dest-chains";
import { useCreatePayment, useUpdatePayment } from "@/lib/api";

const CCIP_MESSAGE_ID_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

function extractMessageIdFromLogs(logs: { topics: `0x${string}`[]; data: string }[]): string {
  for (const log of logs) {
    if (log.topics.length >= 3 && log.topics[1] === CCIP_MESSAGE_ID_TOPIC) {
      return log.topics[2];
    }
  }
  for (const log of logs) {
    if (log.topics.length >= 2 && log.data && log.data.length >= 66) {
      const candidate = log.data.slice(0, 66) as `0x${string}`;
      if (candidate.startsWith("0x") && candidate.length === 66) {
        return candidate;
      }
    }
  }
  return "";
}

export type CcipQuote = {
  fee: string;
  feeTokenSymbol: string;
  isSupported: boolean;
};

export type CcipResult =
  | {
      status: "settled";
      id: string;
      messageId: string;
      txHash: string;
      ccipExplorerUrl: string;
    }
  | { status: "failed"; error: string }
  | { status: "declined"; reason: string };

interface CcipSendInput {
  destChainSelector: string;
  destChainId: number;
  receiver: Address;
  tokenAddress: Address;
  tokenAmount: bigint;
  tokenSymbol: string;
  amountHuman: string;
  recipientLabel: string | null;
  memo: string | null;
}

export function useCcipBridge() {
  const { address, isConnected, chainId } = useAccount();
  const sepoliaClient = usePublicClient({ chainId: CCIP_SOURCE_CHAIN_ID });
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const quote = useCallback(
    async (input: {
      sourceChainId: number;
      destChainSelector: string;
      receiver: string;
      tokenAddress: string;
      tokenAmount: string;
    }): Promise<CcipQuote | null> => {
      setIsQuoting(true);
      try {
        const srcId = input.sourceChainId || CCIP_SOURCE_CHAIN_ID;
        if (!sepoliaClient || !isCcipConfigured(srcId)) return null;
        const router = ccipRouterAddress(srcId);
        const receiverEncoded = encodeAbiParameters(
          [{ type: "address" }],
          [getAddress(input.receiver)],
        ) as Hex;

        const fee = (await sepoliaClient.readContract({
          address: router,
          abi: CCIP_ROUTER_ABI,
          functionName: "getFee",
          args: [
            BigInt(input.destChainSelector),
            {
              receiver: receiverEncoded,
              data: "0x",
              tokenAmounts: [
                { token: input.tokenAddress as Address, amount: BigInt(input.tokenAmount) },
              ],
              feeToken: "0x0000000000000000000000000000000000000000" as Address,
              extraArgs: buildExtraArgs(),
            },
          ],
        })) as bigint;

        return {
          fee: fee.toString(),
          feeTokenSymbol: "ETH",
          isSupported: true,
        };
      } catch {
        return null;
      } finally {
        setIsQuoting(false);
      }
    },
    [sepoliaClient],
  );

  const send = useCallback(
    async (input: CcipSendInput): Promise<CcipResult> => {
      if (!isConnected || !address) {
        return { status: "declined", reason: "no-wallet" };
      }
      if (!isCcipConfigured(CCIP_SOURCE_CHAIN_ID)) {
        return {
          status: "failed",
          error: "CCIP not configured",
        };
      }
      if (chainId !== CCIP_SOURCE_CHAIN_ID) {
        try {
          const switchTimeout = new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("switch timeout")), 15_000),
          );
          await Promise.race([
            switchChainAsync({ chainId: CCIP_SOURCE_CHAIN_ID }),
            switchTimeout,
          ]);
        } catch (switchErr) {
          const msg = switchErr instanceof Error ? switchErr.message : "";
          if (msg.includes("rejected") || msg.includes("denied")) {
            return { status: "declined", reason: "Network switch rejected" };
          }
          return {
            status: "failed",
            error: `Could not switch to Ethereum Sepolia (chain ${CCIP_SOURCE_CHAIN_ID}). Please switch manually.`,
          };
        }
      }

      const destChain = getDestChain(input.destChainId);
      if (!destChain) {
        return {
          status: "failed",
          error: `Unsupported destination chain ${input.destChainId}`,
        };
      }

      const router = ccipRouterAddress(CCIP_SOURCE_CHAIN_ID);

      setIsSending(true);
      try {
        const feeResult = await quote({
          sourceChainId: CCIP_SOURCE_CHAIN_ID,
          destChainSelector: input.destChainSelector,
          receiver: input.receiver,
          tokenAddress: input.tokenAddress,
          tokenAmount: input.tokenAmount.toString(),
        });
        if (!feeResult || !feeResult.isSupported) {
          return {
            status: "failed",
            error: "Could not quote CCIP fee — destination may be unsupported",
          };
        }

        try {
          const allowance = (await sepoliaClient?.readContract({
            address: input.tokenAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, router],
          })) as bigint | undefined;

          if (allowance === undefined || allowance < input.tokenAmount) {
            const approveTxHash = await writeContractAsync({
              address: input.tokenAddress,
              abi: erc20Abi,
              functionName: "approve",
              args: [router, maxUint256],
              chainId: CCIP_SOURCE_CHAIN_ID,
            });
            if (sepoliaClient) {
              await sepoliaClient.waitForTransactionReceipt({
                hash: approveTxHash as Hash,
                confirmations: 1,
              });
            }
          }
        } catch (approveErr) {
          const msg =
            approveErr instanceof Error ? approveErr.message : "";
          if (
            msg.includes("rejected") ||
            msg.includes("denied")
          ) {
            return { status: "declined", reason: "Token approval rejected" };
          }
          console.warn("[ccip] approve failed, proceeding:", approveErr);
        }

        const ccipMessage = buildEvm2AnyMessage({
          receiver: input.receiver,
          tokenAddress: input.tokenAddress,
          tokenAmount: input.tokenAmount,
        });

        const data = encodeFunctionData({
          abi: CCIP_ROUTER_ABI,
          functionName: "ccipSend",
          args: [
            BigInt(input.destChainSelector),
            ccipMessage,
          ],
        });

        let txHash: string;
        try {
          txHash = await sendTransactionAsync({
            to: router,
            data,
            value: BigInt(feeResult.fee),
            chainId: CCIP_SOURCE_CHAIN_ID,
          });
        } catch (sendErr) {
          const msg = sendErr instanceof Error ? sendErr.message : "";
          if (msg.includes("rejected") || msg.includes("denied")) {
            return { status: "declined", reason: "CCIP send rejected" };
          }
          throw sendErr;
        }

        let messageId = "";
        if (sepoliaClient) {
          const receipt = await sepoliaClient.waitForTransactionReceipt({
            hash: txHash as Hash,
            confirmations: 1,
          });

          if (receipt.status === "reverted") {
            return {
              status: "failed",
              error: "CCIP send transaction reverted on Sepolia",
            };
          }

          messageId = extractMessageIdFromLogs(receipt.logs);
        }

        const created = await createPayment.mutateAsync({
          recipientAddress: input.receiver,
          recipientLabel: input.recipientLabel,
          token: input.tokenSymbol,
          amountHuman: input.amountHuman,
          memo: input.memo,
          chainId: CCIP_SOURCE_CHAIN_ID,
          senderAddress: address,
        });

        await updatePayment.mutateAsync({
          id: created.id,
          status: "settled",
          txHash,
          ccipMessageId: messageId,
          ccipSourceChainId: CCIP_SOURCE_CHAIN_ID,
          ccipDestChainId: input.destChainId,
          ccipDestChainSelector: input.destChainSelector,
          viaCcip: true,
        });

        return {
          status: "settled",
          id: created.id,
          messageId,
          txHash,
          ccipExplorerUrl: messageId
            ? CCIP_EXPLORER_MESSAGE_URL(messageId)
            : "",
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "CCIP send failed";
        if (msg.includes("rejected") || msg.includes("denied")) {
          return { status: "declined", reason: msg };
        }
        return { status: "failed", error: msg };
      } finally {
        setIsSending(false);
      }
    },
    [
      address,
      chainId,
      isConnected,
      sepoliaClient,
      switchChainAsync,
      sendTransactionAsync,
      writeContractAsync,
      createPayment,
      updatePayment,
      quote,
    ],
  );

  return {
    quote,
    send,
    isQuoting,
    isSending,
    canCcip: isCcipConfigured(CCIP_SOURCE_CHAIN_ID),
  };
}
