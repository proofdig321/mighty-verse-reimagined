import {
  parseAttributionDisplayName,
  displayNameFromIdentityRef,
  encodeDisplayIdentityRef,
  pickPublicDisplayName,
  normalizeParticipantStatus,
  isParticipantRoleType,
} from "../names.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(parseAttributionDisplayName("Canonical creator — Golden Shovel") === "Golden Shovel", "em-dash attribution yields the public name");
assert(parseAttributionDisplayName("Featured artist on Super Hero Ego — Proverb") === "Proverb", "featured-artist attribution yields Proverb");
assert(parseAttributionDisplayName("Featured artist on Super Hero Ego — Reason") === "Reason", "featured-artist attribution yields Reason");
assert(parseAttributionDisplayName("Featured artist on Super Hero Ego — Mothipa") === "Mothipa", "featured-artist attribution yields Mothipa");
assert(
  parseAttributionDisplayName("Golden Shovel warrior manifestation — canonical Scene extracted from Super Hero Ego Mural") === null,
  "scene extraction copy is not a participant name",
);
assert(parseAttributionDisplayName("Director of the Super Hero Ego Mural") === null, "role-only copy is not a name");
assert(displayNameFromIdentityRef("display:Golden Shovel") === "Golden Shovel", "operator display link decodes");
assert(encodeDisplayIdentityRef("  ProVerb  ") === "display:ProVerb", "operator display link encodes a trimmed name");
assert(
  pickPublicDisplayName([
    { contribution_description: "Director of the Super Hero Ego Mural" },
    { contribution_description: "Canonical creator — Golden Shovel" },
  ]) === "Golden Shovel",
  "public catalogue prefers a real name over role-only copy",
);
assert(normalizeParticipantStatus("inactive") === "suspended", "inactive maps onto canonical suspended");
assert(normalizeParticipantStatus("active") === "active", "active stays active");
assert(isParticipantRoleType("featured-artist"), "featured-artist is a real role");
assert(!isParticipantRoleType("artist"), "artist is not a participant_role_type value");

console.log("participant names: ok");
