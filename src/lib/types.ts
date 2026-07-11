export type PaymentStatus =
  | "parsing"
  | "clarifying"
  | "reviewing"
  | "signing"
  | "settling"
  | "settled"
  | "failed"
  | "pending"
  | "approving"
  | "deploying"
  | "sent";

export interface CrossChainIntent {
  destChainId: number;
  destChainName: string;
  destRecipientAddress: `0x${string}`;
  destTokenSymbol: string;
}

export interface PaymentIntent {
  recipientLabel: string | null;
  recipientAddress: `0x${string}`;
  token: string;
  amountHuman: string;
  amountBaseUnits: string;
  memo?: string | null;
  requiresConfirmation: true;
  confidence?: number;
  aiGenerated?: boolean;
  crossChain?: CrossChainIntent;
}

export type MessageRole = "user" | "assistant";

export interface ContactResult {
  id: string;
  label: string;
  address: string;
  note: string | null;
  favorite: boolean;
}

export interface PaymentHistoryResult {
  id: string;
  recipientLabel: string | null;
  recipientAddress: string;
  token: string;
  amountHuman: string;
  memo: string | null;
  status: string;
  txHash: string | null;
  chainId: number;
  createdAt: number;
}

export interface ChatMessageData {
  id: string;
  role: MessageRole;
  content: string;
  intent?: PaymentIntent;
  status?: PaymentStatus;
  txHash?: string;
  paymentId?: string;
  chainId?: number;
  createdAt: number;
  aiGenerated?: boolean;
  reasoning?: string;
  contacts?: ContactResult[];
  payments?: PaymentHistoryResult[];
  hspStatus?: string | null;
  hspVerified?: boolean | null;
  hspDecision?: string | null;
  hspPaymentId?: string | null;
  viaHsp?: boolean;
  ccipMessageId?: string;
  ccipExplorerUrl?: string;
  viaCcip?: boolean;
  paymentStep?: string;
  streaming?: boolean;
  anchored?: { txHash?: string | null; intentHash?: string; alreadyExisted?: boolean } | null;
  isAnchoring?: boolean;
  anchorError?: string | null;
}
