import { storyboardAssociationStatus } from "../association";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const unattached = storyboardAssociationStatus(null);
assert(unattached.attached === false && unattached.required === true, "standalone storyboard work needs an attachment decision");
assert(unattached.label === "Standalone work", "standalone state is labeled clearly");

const attached = storyboardAssociationStatus("universe-123");
assert(attached.attached === true && attached.required === false, "attached work is no longer in standalone mode");
assert(attached.label === "Attached to universe", "attached state is labeled clearly");

console.log("Storyboard association status tests: all passed");
