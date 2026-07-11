import {
  mandateHash as computeMandateHash,
  requiredCapabilitiesHash,
  type Mandate,
  type SignedMandate,
  type Receipt,
} from "@hsp/core";
import { eip712EoaSigner } from "@hsp/core/profiles/signer/eip712-eoa";
import { HSPVerifier } from "@hsp/sdk";
import {
  getAddress,
  decodeAbiParameters,
  encodeAbiParameters,
  recoverAddress,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { getHspConfig } from "./config";
import type { PaymentRow } from "@/db/schema";

const TERMINAL_STATUSES = new Set(["SETTLED", "FAILED", "DISPUTED", "EXPIRED"]);

export interface BuiltMandate {
  body: Mandate;
  mandateHash: Hex;
}

export function buildMandate(params: {
  payer: Address;
  to: Address;
  amount: string;
  token: Address;
  deadline: number;
  chainId?: number;
}): BuiltMandate {
  const { chain, domain } = getHspConfig(params.chainId);
  const body: Mandate = {
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
    signer: {
      profileId: eip712EoaSigner.profileIdHash,
      payload: encodeAbiParameters([{ type: "address" }], [getAddress(params.payer)]),
    },
    recipient: {
      kind: 0,
      payload: encodeAbiParameters([{ type: "address" }], [getAddress(params.to)]),
    },
    token: getAddress(params.token),
    amount: params.amount,
    chainId: chain.chainId,
    deadline: params.deadline,
    requiredCapabilitiesHash: requiredCapabilitiesHash([]),
  };
  return { body, mandateHash: computeMandateHash(domain, body) };
}

async function coordinatorHttp(
  method: string,
  path: string,
  body?: unknown,
  chainId?: number,
): Promise<{ status: number; json: unknown }> {
  const { coordinatorUrl, apiKey } = getHspConfig(chainId);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${coordinatorUrl.replace(/\/$/, "")}${path}`, init);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

const operatorUrlCache = new Map<number, string | null>();
async function resolveOperatorUrl(chainId?: number): Promise<string | null> {
  const cacheKey = chainId ?? -1;
  const cached = operatorUrlCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const { chain } = getHspConfig(chainId);
  try {
    const r = await coordinatorHttp("GET", "/chains", undefined, chainId);
    const chains = (r.json as Array<{ name: string; adapterOperatorUrl?: string | null }>) ?? [];
    const entry = chains.find((c) => c.name === chain.name);
    const result = entry?.adapterOperatorUrl
      ? entry.adapterOperatorUrl.replace(/\/$/, "")
      : null;
    operatorUrlCache.set(cacheKey, result);
    return result;
  } catch {
    operatorUrlCache.set(cacheKey, null);
    return null;
  }
}

function normalizeV(sig: Hex): Hex {
  if (sig.length !== 132) return sig;
  const v = parseInt(sig.slice(130, 132), 16);
  return v === 0 || v === 1
    ? (`${sig.slice(0, 130)}${(v + 27).toString(16).padStart(2, "0")}` as Hex)
    : sig;
}

/**
 * Step 1 of the HSP flow: register the signed mandate with the Coordinator
 * BEFORE broadcasting the on-chain transfer.
 *
 * The Coordinator receives the mandate + signature. It can validate the
 * signature and enforce any deployment-level policy floor. Only after this
 * succeeds should the client send the transaction.
 */
export async function registerMandate(params: {
  paymentId: Hex;
  mandateBody: Mandate;
  mandateSignature: Hex;
  chainId?: number;
}): Promise<{ ok: boolean; hspPaymentId: Hex; error?: string }> {
  const { domain, chain } = getHspConfig(params.chainId);

  const expectedHash = computeMandateHash(domain, params.mandateBody);
  if (expectedHash.toLowerCase() !== params.paymentId.toLowerCase()) {
    return { ok: false, hspPaymentId: params.paymentId, error: "mandateBody hash mismatch" };
  }

  const sig = normalizeV(params.mandateSignature);

  const payer = getAddress(
    decodeAbiParameters([{ type: "address" }], params.mandateBody.signer.payload)[0] as Address,
  );
  let recovered: Address;
  try {
    recovered = await recoverAddress({ hash: expectedHash, signature: sig });
  } catch {
    return { ok: false, hspPaymentId: params.paymentId, error: "signature recovery failed" };
  }
  if (getAddress(recovered) !== payer) {
    return {
      ok: false,
      hspPaymentId: params.paymentId,
      error: `signature recovers to ${recovered}, expected ${payer}`,
    };
  }

  const mandate: SignedMandate = {
    body: params.mandateBody,
    signerProof: sig,
    requiredCapabilities: [],
  };

  const reg = await coordinatorHttp("POST", "/payments", {
    chain: chain.name,
    mandate,
    attestations: [],
  });

  // 409 = paymentId already registered (idempotent — mandate hash is deterministic)
  if (reg.status !== 200 && reg.status !== 201 && reg.status !== 409) {
    const detail = JSON.stringify(reg.json);
    return {
      ok: false,
      hspPaymentId: params.paymentId,
      error: `HSP Coordinator rejected mandate: HTTP ${reg.status} — ${detail}`,
    };
  }

  return { ok: true, hspPaymentId: params.paymentId };
}

export interface SubmitResult {
  hspStatus: string;
  hspVerified: boolean;
  hspDecision: string | null;
  hspReceipt: Receipt | null;
  hspSettledAt: number | null;
  error?: string;
}

/**
 * Step 2 of the HSP flow: after the on-chain transfer is broadcast, hand
 * the txHash to the Coordinator so it can observe the transfer, emit a
 * signed Receipt, and reach SETTLED / FAILED.
 */
export async function observeAndSettle(params: {
  paymentId: Hex;
  mandateBody: Mandate;
  mandateSignature: Hex;
  txHash: Hex;
  chainId?: number;
}): Promise<SubmitResult> {
  const { adapterAddress, chain } = getHspConfig(params.chainId);

  const sig = normalizeV(params.mandateSignature);
  const mandate: SignedMandate = {
    body: params.mandateBody,
    signerProof: sig,
    requiredCapabilities: [],
  };

  const operatorUrl = await resolveOperatorUrl(params.chainId);
  const coordinatorUrl = getHspConfig(params.chainId).coordinatorUrl.replace(/\/$/, "");

  let observed = false;
  for (let i = 0; i <= 30; i++) {
    const { apiKey } = getHspConfig(params.chainId);
    const obs = operatorUrl
      ? await fetch(`${operatorUrl}/observe/evm-transfer`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ coordinatorUrl, paymentId: params.paymentId, txHash: params.txHash }),
        })
      : await coordinatorHttp("POST", `/payments/${params.paymentId}/observe`, {
          txHash: params.txHash,
        }, params.chainId);

    const obsStatus = operatorUrl
      ? (obs as Response).status
      : (obs as { status: number }).status;

    if (obsStatus === 202) {
      await new Promise((r) => setTimeout(r, 800));
      continue;
    }
    if (obsStatus === 200) {
      observed = true;
      break;
    }
    if (i < 5) {
      await new Promise((r) => setTimeout(r, 800));
      continue;
    }
    break;
  }

  if (!observed) {
    return {
      hspStatus: "PENDING",
      hspVerified: false,
      hspDecision: null,
      hspReceipt: null,
      hspSettledAt: null,
      error: "observe timed out — HSP will settle asynchronously via polling",
    };
  }

  for (let i = 0; i < 30; i++) {
    const snap = await coordinatorHttp("GET", `/payments/${params.paymentId}`, undefined, params.chainId);
    if (snap.status !== 200) {
      await new Promise((r) => setTimeout(r, 800));
      continue;
    }
    const j = snap.json as {
      status?: string;
      receipts?: Receipt[];
      lastDecision?: { outcomeClass?: string };
    };
    if (j.status && TERMINAL_STATUSES.has(j.status)) {
      const receipt = j.receipts?.[0] ?? null;
      const decision = j.lastDecision?.outcomeClass ?? null;

      let verified = false;
      if (receipt && j.status === "SETTLED") {
        try {
          const verifier = new HSPVerifier({ chain, adapterAddress });
          const result = await verifier.verify(mandate, receipt, []);
          verified = result.ok && result.outcomeClass === "ACCEPT";
        } catch {
          verified = false;
        }
      }

      return {
        hspStatus: j.status,
        hspVerified: verified,
        hspDecision: decision,
        hspReceipt: receipt,
        hspSettledAt: receipt ? Number(receipt.settledAt) * 1000 : null,
      };
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  return {
    hspStatus: "PENDING",
    hspVerified: false,
    hspDecision: null,
    hspReceipt: null,
    hspSettledAt: null,
    error: "timed out waiting for terminal status",
  };
}

export interface SyncResult {
  hspStatus: string | null;
  hspVerified: boolean;
  hspDecision: string | null;
  hspSettledAt: number | null;
  hspReceipt: Receipt | null;
}

export async function syncPayment(row: PaymentRow, chainId?: number): Promise<SyncResult | null> {
  if (!row.hspPaymentId) return null;
  if (row.hspStatus && TERMINAL_STATUSES.has(row.hspStatus)) return null;

  const { chain, adapterAddress } = getHspConfig(chainId);
  const paymentId = row.hspPaymentId as Hex;

  const snap = await coordinatorHttp("GET", `/payments/${paymentId}`, undefined, chainId);
  if (snap.status !== 200) return null;

  const j = snap.json as {
    status?: string;
    mandate?: SignedMandate;
    receipts?: { receipt: Receipt; seq: number; decision?: Record<string, unknown>; createdAt?: number }[];
    lastDecision?: { outcomeClass?: string };
  };
  if (!j.status) return null;

  if (!TERMINAL_STATUSES.has(j.status)) {
    return {
      hspStatus: j.status,
      hspVerified: false,
      hspDecision: j.lastDecision?.outcomeClass ?? null,
      hspSettledAt: null,
      hspReceipt: null,
    };
  }

  const receipt = j.receipts?.[0]?.receipt ?? null;
  let verified = false;
  if (receipt && j.status === "SETTLED" && j.mandate) {
    try {
      const verifier = new HSPVerifier({ chain, adapterAddress });
      const decision = await verifier.verify(j.mandate, receipt, []);
      verified = decision.ok && decision.outcomeClass === "ACCEPT";
      if (!verified) {
        console.error("HSPVerifier rejected:", decision);
      }
    } catch (err) {
      console.error("HSPVerifier threw:", err);
      verified = false;
    }
  }

  return {
    hspStatus: j.status,
    hspVerified: verified,
    hspDecision: j.lastDecision?.outcomeClass ?? null,
    hspSettledAt: receipt ? Number(receipt.settledAt) * 1000 : null,
    hspReceipt: receipt,
  };
}
