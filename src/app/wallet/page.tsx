import { WalletPanel } from "./wallet-panel";

// Wallet state is fully client-side; opt out of static prerender so the
// Reown AppKit modal mounts without triggering prerender-time fetches.
export const instant = false;

export default function WalletPage() {
  return <WalletPanel />;
}
