import nextConfig from "eslint-config-next";

const config = [
  {
    ignores: [
      ".next/**",
      "qa/browser/playwright-report/**",
      "qa/browser/test-results/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...nextConfig,
];
export default config;
