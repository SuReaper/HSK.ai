"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { type Address, type Hex, encodeAbiParameters, getAddress } from "viem";
import { CCIP_ROUTER_ABI, buildExtraArgs } from "@/lib/ccip/router-abi";
import { ccipRouterAddress, isCcipConfigured } from "@/lib/ccip/config";
import { CCIP_SOURCE_CHAIN_ID } from "@/lib/ccip/dest-chains";
import type { CcipQuote } from "@/lib/use-ccip-bridge";

interface UseCcipQuoteArgs {
  sourceChainId?: number;
  destChainSelector?: string;
  receiver?: string;
  tokenAddress?: string;
  tokenAmount?: string;
  enabled?: boolean;
}

export function useCcipQuote(args: UseCcipQuoteArgs) {
  const [quote, setQuote] = useState<CcipQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled =
    args.enabled !== false &&
    !!args.sourceChainId &&
    !!args.destChainSelector &&
    !!args.receiver &&
    !!args.tokenAddress &&
    !!args.tokenAmount;

  const { sourceChainId, destChainSelector, receiver, tokenAddress, tokenAmount } = args;
  const sepoliaClient = usePublicClient({ chainId: CCIP_SOURCE_CHAIN_ID });

  useEffect(() => {
    if (!enabled || !sourceChainId || !destChainSelector || !receiver || !tokenAddress || !tokenAmount) return;
    if (!sepoliaClient || !isCcipConfigured(sourceChainId)) return;
    let cancelled = false;

    const doFetch = async () => {
      try {
        const router = ccipRouterAddress(sourceChainId);
        const receiverEncoded = encodeAbiParameters(
          [{ type: "address" }],
          [getAddress(receiver)],
        ) as Hex;

        const fee = (await sepoliaClient.readContract({
          address: router,
          abi: CCIP_ROUTER_ABI,
          functionName: "getFee",
          args: [
            BigInt(destChainSelector),
            {
              receiver: receiverEncoded,
              data: "0x",
              tokenAmounts: [
                { token: tokenAddress as Address, amount: BigInt(tokenAmount) },
              ],
              feeToken: "0x0000000000000000000000000000000000000000" as Address,
              extraArgs: buildExtraArgs(),
            },
          ],
        })) as bigint;

        if (cancelled) return;
        setQuote({
          fee: fee.toString(),
          feeTokenSymbol: "ETH",
          isSupported: true,
        });
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Quote failed");
        setQuote(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    Promise.resolve().then(() => setLoading(true));
    doFetch();

    return () => {
      cancelled = true;
    };
  }, [enabled, sourceChainId, destChainSelector, receiver, tokenAddress, tokenAmount, sepoliaClient]);

  return { quote, loading, error };
}
