import { validateUniverseIdentity, mergeWorkPresentationIdentity } from "../identity";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const valid = validateUniverseIdentity({
  title: "  Super Hero Ego  ",
  description: "  Golden Shovel ft Proverb, Reason and Mothipa  ",
});
assert(valid.ok === true, "canonical Super Hero Ego identity is valid");
assert(valid.value.title === "Super Hero Ego", "title is trimmed");
assert(valid.value.description === "Golden Shovel ft Proverb, Reason and Mothipa", "description is trimmed");

const missing = validateUniverseIdentity({ title: "   ", description: "ignored" });
assert(missing.ok === false && missing.error === "Title is required.", "blank title is rejected");

const emptyDescription = validateUniverseIdentity({ title: "Super Hero Ego", description: "   " });
assert(emptyDescription.ok === true && emptyDescription.value.description === null, "blank description becomes null");

const existing = {
  title: "Super Hero Ego",
  description: "Golden Shovel ft Proverb, Reason and Mothipa",
  description_md: "editorial",
  artwork_asset_id: "art-1",
};
const identityOnly = mergeWorkPresentationIdentity(
  "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
  { title: "Super Hero Ego", description: "Golden Shovel ft Proverb, Reason and Mothipa" },
  existing,
  { master_id: "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc", title: "Super Hero Ego" },
);
assert(identityOnly.description_md === "editorial", "identity save preserves description_md");
assert(identityOnly.artwork_asset_id === "art-1", "identity save preserves artwork");

const withExtras = mergeWorkPresentationIdentity(
  "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
  { title: "Super Hero Ego", description: null },
  existing,
  { description_md: "", artwork_asset_id: "" },
);
assert(withExtras.description_md === null, "explicit empty description_md clears");
assert(withExtras.artwork_asset_id === null, "explicit empty artwork clears");

console.log("Assemble Universe identity tests: all passed");
