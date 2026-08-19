import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@x402/core/client": { browser: "./src/lib/web3/empty.ts", default: "./src/lib/web3/empty.ts" },
      "@x402/evm": { browser: "./src/lib/web3/empty.ts", default: "./src/lib/web3/empty.ts" },
      "@x402/evm/exact/client": { browser: "./src/lib/web3/empty.ts", default: "./src/lib/web3/empty.ts" },
      "@x402/evm/upto/client": { browser: "./src/lib/web3/empty.ts", default: "./src/lib/web3/empty.ts" },
      "@x402/svm/exact/client": { browser: "./src/lib/web3/empty.ts", default: "./src/lib/web3/empty.ts" },
    },
  },
};

export default nextConfig;
