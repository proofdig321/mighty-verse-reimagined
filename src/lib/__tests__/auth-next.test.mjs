import { safeAuthNext } from "../auth-next";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(safeAuthNext("/authority/universes") === "/authority/universes", "relative workspace paths are kept");
assert(safeAuthNext("https://evil.example") === "/authority", "absolute URLs are rejected");
assert(safeAuthNext("//evil.example") === "/authority", "protocol-relative URLs are rejected");
assert(safeAuthNext(null) === "/authority", "missing next falls back to dashboard");

console.log("Auth next tests: all passed");
