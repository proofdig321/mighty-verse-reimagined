import nextConfig from "eslint-config-next";

const config = [
  {
    ignores: [
      ".next/**",
      "qa/browser/playwright-report/**",
      "qa/browser/playwright-report-production/**",
      "qa/browser/test-results/**",
      "qa/browser/test-results-production/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...nextConfig,
];
export default config;
