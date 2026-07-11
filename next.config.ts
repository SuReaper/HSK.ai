import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  serverExternalPackages: ["better-sqlite3", "drizzle-orm"],
  transpilePackages: ["@hsp/core", "@hsp/sdk"],
  productionBrowserSourceMaps: false,
  compress: true,
  generateEtags: false,
  poweredByHeader: false,
  httpAgentOptions: {
    keepAlive: true,
  },
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 3600,
  },
  experimental: {},
  webpack: (config) => {
    // mppx > ox ships a require(expression) dynamic require inside its tempo
    // virtual-master-pool. That triggers "Critical dependency: the request of
    // a dependency is an expression". Marking expression-context contexts as
    // non-critical silences the warning without breaking the import graph.
    config.module = config.module ?? {};
    config.module.exprContextCritical = false;

    // @hsp/core and @hsp/sdk ship TypeScript source via their package "exports"
    // map (./* -> ./src/*.ts). Their source imports siblings using explicit
    // ".js" extensions (e.g. "./core/index.js"). TypeScript maps ".js"->".ts"
    // during typecheck, but webpack does not by default. Map ".js" requests to
    // ".ts" first so the HSP route handlers bundle correctly.
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".js"],
    };

    return config;
  },
};

export default nextConfig;
