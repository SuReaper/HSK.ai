"use client";

import { useState } from "react";
import { HelpCircle, Search, ChevronDown, MessageSquare, Bug, Mail } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FAQ {
  q: string;
  a: string;
}

const FAQS: FAQ[] = [
  {
    q: "How do I send a payment?",
    a: "Open the Chat page and type a payment instruction in plain English — e.g. 'send 5 USDC to Alice for coffee'. The AI will parse your message, show a review card, and ask you to confirm before signing.",
  },
  {
    q: "What wallets are supported?",
    a: "HSK.ai connects to any WalletConnect-compatible wallet via Reown AppKit (MetaMask, Rabby, Rainbow, etc.). Click 'Connect Wallet' in the top bar to get started.",
  },
  {
    q: "Which network is this on?",
    a: "The demo runs on HashKey Chain Testnet (Chain ID 133). RPC: https://testnet.hsk.xyz. Explorer: https://testnet-explorer.hsk.xyz.",
  },
  {
    q: "Can I cancel a payment?",
    a: "Yes — while the payment is in the 'Awaiting confirmation' state you can tap Cancel. Once you click Confirm & Pay, the transaction is broadcast and cannot be reversed.",
  },
  {
    q: "Is my data stored anywhere?",
    a: "No. This demo stores everything in your browser — contacts in localStorage, messages in memory. Nothing is sent to a server. A future version may add optional server-side contacts sync.",
  },
  {
    q: "Why did my payment fail?",
    a: "Common reasons: insufficient USDC balance, wrong network, or the recipient address is invalid. Check the Payments page for the failure reason and retry from the chat.",
  },
];

function FAQItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface-2/40">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-foreground">{faq.q}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="px-4 pb-3 text-sm text-muted">{faq.a}</div>
      ) : null}
    </div>
  );
}

export default function HelpPage() {
  const [query, setQuery] = useState("");

  const filtered = FAQS.filter((f) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
  });

  return (
    <PageContainer
      title="Help & Support"
      description="Frequently asked questions and support resources"
      icon={<HelpCircle className="h-5 w-5" />}
    >
      <Card>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-3">
          <Search className="h-4 w-4 text-muted-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search FAQ…"
            className="flex-1 bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-2 focus:outline-none"
          />
        </div>
      </Card>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-muted">
              No results for &ldquo;{query}&rdquo;. Try a different search.
            </p>
          </Card>
        ) : (
          filtered.map((faq) => <FAQItem key={faq.q} faq={faq} />)
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">Community</p>
          <p className="text-xs text-muted-2">Join the Discord for help</p>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm" className="mt-1">Join</Button>
          </a>
        </Card>
        <Card className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <Bug className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">Report a bug</p>
          <p className="text-xs text-muted-2">Found an issue? Let us know</p>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm" className="mt-1">Report</Button>
          </a>
        </Card>
        <Card className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
            <Mail className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">Email support</p>
          <p className="text-xs text-muted-2">support@hsk.ai</p>
          <Button variant="secondary" size="sm" className="mt-1">Contact</Button>
        </Card>
      </div>
    </PageContainer>
  );
}
