import { studioInteractionLabel, studioPhaseForTab, STUDIO_INTERACTION_PHASES } from "../studio-interaction";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(studioInteractionLabel() === "Context → Work → Directive", "Studio interaction model is Context → Work → Directive");
assert(STUDIO_INTERACTION_PHASES.length === 3, "three phases, no Shot entity");
assert(studioPhaseForTab("sentinel").id === "context", "Sentinel is Context evidence");
assert(studioPhaseForTab("script").id === "work", "Script is Work");
assert(studioPhaseForTab("assist").id === "directive", "AI Assist is Directive");
assert(studioPhaseForTab("sentinel").note.includes("does not author"), "Sentinel does not author creative meaning");
assert(studioPhaseForTab("assist").note.includes("Separate from Sentinel"), "creator directives stay separate from Sentinel");

console.log("Studio interaction model tests: all passed");
