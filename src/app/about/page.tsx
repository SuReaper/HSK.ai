import { Info, Code2, ExternalLink, Cpu, Zap, Globe } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { Card } from "@/components/ui/card";
import { Wordmark } from "@/components/wordmark";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

const TECH_STACK = [
  { name: "Next.js 16", desc: "App router, Webpack, Server Components" },
  { name: "React 19", desc: "React Compiler enabled" },
  { name: "TypeScript", desc: "End-to-end type safety" },
  { name: "Tailwind CSS v4", desc: "Utility-first styling, design tokens" },
  { name: "Motion", desc: "Spring-based animations" },
  { name: "HashKey Chain", desc: "EVM-compatible L1, Chain ID 133" },
  { name: "viem", desc: "TypeScript blockchain interactions" },
];

const FEATURES = [
  { icon: Zap, title: "Intent-to-Pay", desc: "Describe payments in plain English — the AI parses, structures, and executes." },
  { icon: Cpu, title: "AI Tool-Calling", desc: "LLM extracts recipients, amounts, and memos from natural language." },
  { icon: Globe, title: "HashKey Chain", desc: "Built on the testnet with USDC and HSK native token support." },
];

export default function AboutPage() {
  return (
    <PageContainer
      title="About"
      description="HSK.ai — the intent-to-pay assistant for HashKey Chain"
      icon={<Info className="h-5 w-5" />}
    >
      <Card>
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
            H
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground"><Wordmark className="text-lg" /></h2>
            <p className="mt-1 text-sm text-muted">
            HSK.ai turns plain-English payment instructions into on-chain
            transfers on HashKey Chain. Instead of navigating complex wallet UIs, users
            simply describe what they want to pay — and the AI assistant handles parsing,
            confirmation, signing, and transaction observability.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-2">Version</p>
            <p className="text-sm font-medium text-foreground">0.1.0</p>
          </div>
          <div>
            <p className="text-xs text-muted-2">Network</p>
            <p className="text-sm font-medium text-foreground">Testnet</p>
          </div>
          <div>
            <p className="text-xs text-muted-2">Chain ID</p>
            <p className="text-sm font-medium text-foreground">133</p>
          </div>
          <div>
            <p className="text-xs text-muted-2">License</p>
            <p className="text-sm font-medium text-foreground">MIT</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.title}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{f.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{f.desc}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Tech stack</h2>
        <div className="space-y-2">
          {TECH_STACK.map((tech) => (
            <div
              key={tech.name}
              className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{tech.name}</p>
                <p className="text-xs text-muted-2">{tech.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Links</h2>
        <div className="space-y-2">
          {[
            { label: "HashKey Chain Docs", href: "https://hashkey.com", icon: ExternalLink },
            { label: "Source code", href: "https://github.com", icon: Code2 },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-4 py-2.5 text-sm text-foreground transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                <Icon className="h-4 w-4 text-muted" />
                <span className="flex-1">{link.label}</span>
                <ExternalLink className="h-3.5 w-3 text-muted-2" />
              </a>
            );
          })}
        </div>
      </Card>
    </PageContainer>
  );
}
