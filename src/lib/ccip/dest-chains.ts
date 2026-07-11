export interface DestChainEntry {
  name: string;
  chainId: number;
  chainSelector: bigint;
  testnet: boolean;
  explorerUrl: string;
}

export const CCIP_FAUCET_URL = "https://faucets.chain.link/ccip";

export const CCIP_DEST_CHAINS: DestChainEntry[] = [
  {
    name: "Base Sepolia",
    chainId: 84532,
    chainSelector: 10344971235874465080n,
    testnet: true,
    explorerUrl: "https://sepolia.basescan.org",
  },
  {
    name: "Arbitrum Sepolia",
    chainId: 421614,
    chainSelector: 3478487238524512106n,
    testnet: true,
    explorerUrl: "https://sepolia.arbiscan.io",
  },
  {
    name: "Optimism Sepolia",
    chainId: 11155420,
    chainSelector: 5224473277236331295n,
    testnet: true,
    explorerUrl: "https://sepolia-optimism.etherscan.io",
  },
  {
    name: "Polygon Amoy",
    chainId: 80002,
    chainSelector: 16281711391670634445n,
    testnet: true,
    explorerUrl: "https://amoy.polygonscan.com",
  },
  {
    name: "Avalanche Fuji",
    chainId: 43113,
    chainSelector: 14767482510784806043n,
    testnet: true,
    explorerUrl: "https://testnet.snowtrace.io",
  },
];

export const CCIP_SOURCE_CHAIN_ID = 11155111;

export function getDestChain(chainId: number): DestChainEntry | undefined {
  return CCIP_DEST_CHAINS.find((c) => c.chainId === chainId);
}

export const CCIP_EXPLORER_MESSAGE_URL = (messageId: string) =>
  `https://ccip.chain.link/msgs/${messageId}`;

export const CCIP_DEST_CHAIN_DESCS = CCIP_DEST_CHAINS.map(
  (c) => `${c.name} (${c.chainId})`,
).join(", ");
