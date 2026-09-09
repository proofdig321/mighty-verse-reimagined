import { curateContinuation } from "../curate-continuation";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const ASSET = "795c057e-2967-4e93-8f5e-06297c674cb0";

const unbound = curateContinuation({ universeId: null, assetId: ASSET });
assert(unbound.actions.length === 0, "unassociated media does not invent Suite continuation");
assert(unbound.copy.includes("does not create a Universe"), "unassociated copy preserves MEDIA ≠ UNIVERSE");

const associated = curateContinuation({
  universeId: UNIVERSE,
  assetId: ASSET,
  associated: true,
  mediaAttached: true,
});
assert(associated.actions.some((a) => a.label === "Inspect"), "associated media offers Inspect");
assert(associated.actions.some((a) => a.label === "Sentinel"), "associated media offers Sentinel");
assert(associated.actions.some((a) => a.label === "Open Creative Suite"), "associated media offers Creative Suite");
assert(associated.copy.includes("Creative Suite"), "associated copy names the Suite continuation");
assert(
  associated.actions.every((a) => !a.href.includes("/worlds/")),
  "Curate continuation does not dump the curator into public Experience",
);

const registered = curateContinuation({
  universeId: UNIVERSE,
  muralRegistered: true,
  mediaAttached: false,
});
assert(registered.actions.some((a) => a.label === "Incoming media"), "registered mural without media points back to incoming media");
assert(registered.actions.some((a) => a.label === "Open Creative Suite"), "registered mural still offers Creative Suite");
assert(registered.copy.includes("Media is not attached"), "registered mural does not pretend media is bound");

console.log("curate-continuation.test.mjs: ok");
