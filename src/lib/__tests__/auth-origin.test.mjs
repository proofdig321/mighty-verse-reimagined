import {
  LEGACY_VERCEL_PRODUCTION_HOST,
  PRODUCTION_APP_ORIGIN,
  authCallbackPath,
  authEmailRedirectTo,
  isAllowedAuthHost,
  publicAppOriginFromHeaders,
  shouldInterceptAuthCode,
} from "../auth-origin";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function headers(map) {
  return {
    get(name) {
      return map[name.toLowerCase()] ?? null;
    },
  };
}

assert(isAllowedAuthHost("mightyverse.goldenshovel.co.za"), "production host is allowed");
assert(isAllowedAuthHost("localhost:3000"), "localhost is allowed");
assert(isAllowedAuthHost("127.0.0.1:3000"), "loopback is allowed");
assert(
  isAllowedAuthHost(`${["mighty", "verse", "reimagined"].join("-")}-git-main.vercel.app`),
  "preview deployments are allowed"
);
assert(
  !isAllowedAuthHost(LEGACY_VERCEL_PRODUCTION_HOST),
  "retired production vercel.app alias is not an allowed sign-in host"
);
assert(!isAllowedAuthHost("evil.vercel.app"), "unrelated Vercel apps are rejected");

assert(
  publicAppOriginFromHeaders(headers({ "x-forwarded-host": "mightyverse.goldenshovel.co.za", "x-forwarded-proto": "https" })) ===
    PRODUCTION_APP_ORIGIN,
  "forwarded custom domain is the public origin"
);
assert(
  publicAppOriginFromHeaders(headers({ host: LEGACY_VERCEL_PRODUCTION_HOST })) ===
    PRODUCTION_APP_ORIGIN,
  "retired vercel.app host remaps to the Golden Shovel domain"
);
assert(
  publicAppOriginFromHeaders(headers({ host: "localhost:3000" })) === "http://localhost:3000",
  "local host stays on http"
);

const pkce = new URLSearchParams("code=681f0b19-e3b8-4d37-b5aa-27e8a5be3bf4&next=%2Fauthority");
assert(shouldInterceptAuthCode("/", pkce), "root PKCE fallback must move to /auth/callback");
assert(shouldInterceptAuthCode("/auth/callback", pkce) === false, "callback itself is not intercepted");
assert(shouldInterceptAuthCode("/", new URLSearchParams()) === false, "pages without code stay put");
assert(
  authCallbackPath(pkce) === "/auth/callback?code=681f0b19-e3b8-4d37-b5aa-27e8a5be3bf4&next=%2Fauthority",
  "callback keeps the PKCE query"
);
assert(
  authEmailRedirectTo(PRODUCTION_APP_ORIGIN, "/authority") ===
    "https://mightyverse.goldenshovel.co.za/auth/callback?next=%2Fauthority",
  "magic-link redirect targets the custom-domain callback"
);

console.log("Auth origin tests: all passed");
