import { type Address, type Hex, encodeAbiParameters, getAddress } from "viem";

export const CCIP_ROUTER_ABI = [
  {
    name: "ccipSend",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "destinationChainSelector", type: "uint64" },
      {
        name: "message",
        type: "tuple",
        components: [
          { name: "receiver", type: "bytes" },
          { name: "data", type: "bytes" },
          {
            name: "tokenAmounts",
            type: "tuple[]",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          { name: "feeToken", type: "address" },
          { name: "extraArgs", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "messageId", type: "bytes32" }],
  },
  {
    name: "getFee",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "destinationChainSelector", type: "uint64" },
      {
        name: "message",
        type: "tuple",
        components: [
          { name: "receiver", type: "bytes" },
          { name: "data", type: "bytes" },
          {
            name: "tokenAmounts",
            type: "tuple[]",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          { name: "feeToken", type: "address" },
          { name: "extraArgs", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "fee", type: "uint256" }],
  },
  {
    name: "isChainSupported",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "destChainSelector", type: "uint64" }],
    outputs: [{ name: "supported", type: "bool" }],
  },
] as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

const CCIP_EXTRA_ARGS_V2_TAG = "0x181dcf10" as Hex;

export function buildExtraArgs(): Hex {
  const encoded = encodeAbiParameters(
    [
      {
        name: "extraArgs",
        type: "tuple",
        components: [
          { name: "gasLimit", type: "uint256" },
          { name: "allowOutOfOrderExecution", type: "bool" },
        ],
      },
    ],
    [{ gasLimit: 0n, allowOutOfOrderExecution: true }],
  );
  return (CCIP_EXTRA_ARGS_V2_TAG + encoded.slice(2)) as Hex;
}

export function buildEvm2AnyMessage(args: {
  receiver: Address;
  tokenAddress: Address;
  tokenAmount: bigint;
}): {
  receiver: Hex;
  data: Hex;
  tokenAmounts: readonly { token: Address; amount: bigint }[];
  feeToken: Address;
  extraArgs: Hex;
} {
  const receiverEncoded = encodeAbiParameters(
    [{ type: "address" }],
    [getAddress(args.receiver)],
  );
  return {
    receiver: receiverEncoded,
    data: "0x",
    tokenAmounts: [{ token: args.tokenAddress, amount: args.tokenAmount }],
    feeToken: ZERO_ADDRESS,
    extraArgs: buildExtraArgs(),
  };
}
