import { muxUploadCorsOrigin } from "../cors-origin.ts";
import { PRODUCTION_APP_ORIGIN } from "../../../../auth-origin.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function request(host, proto = "https") {
  return new Request("https://example.invalid/api", {
    headers: {
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": proto,
    },
  });
}

assert(
  muxUploadCorsOrigin(request("mightyverse.goldenshovel.co.za")) === PRODUCTION_APP_ORIGIN,
  "custom domain is the Mux CORS origin",
);
assert(
  muxUploadCorsOrigin(request("localhost:3000", "http")) === "http://localhost:3000",
  "localhost stays local",
);
assert(
  muxUploadCorsOrigin(PRODUCTION_APP_ORIGIN) === PRODUCTION_APP_ORIGIN,
  "string origin is accepted",
);

const previous = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
assert(muxUploadCorsOrigin() === PRODUCTION_APP_ORIGIN, "production fallback is the custom domain, not VERCEL_URL");
process.env.NODE_ENV = previous;

console.log("Mux CORS origin tests: all passed");
