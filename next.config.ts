import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 treats 127.0.0.1 and localhost as different origins in `next dev`.
  // Chrome requests that send Origin: http://127.0.0.1:3000 then receive HTTP 403
  // Unauthorized on /_next/static chunks (including hls.js). This is a local-dev
  // host allowlist only; it does not change production routing or media behaviour.
  allowedDevOrigins: ["127.0.0.1"],
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
