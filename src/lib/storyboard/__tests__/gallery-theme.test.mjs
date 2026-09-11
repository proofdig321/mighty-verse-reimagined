import { catalogForChrome, parseChromeThemeMatch, pickGalleryTheme } from "../gallery-theme";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const themes = [
  { asset_id: "ref-1", title: "Johannesburg skyline night", role: "environment", still_url: "https://image.mux.com/a/thumbnail.jpg" },
  { asset_id: "ref-2", title: "Golden Shovel portrait", role: "character", still_url: "https://image.mux.com/b/thumbnail.jpg" },
  { asset_id: "ref-3", title: "Unused sketch", role: "style", still_url: null },
];

const skyline = pickGalleryTheme({ title: "EXT. CITY STREET", description: "Night skyline rain" }, themes);
assert(skyline?.title === "Johannesburg skyline night", "environment tokens prefer the skyline gallery still");

const portrait = pickGalleryTheme({ title: "Golden Shovel close-up", description: "character hero" }, themes);
assert(portrait?.title === "Golden Shovel portrait", "character tokens prefer the portrait gallery still");

assert(pickGalleryTheme({ title: "Untitled" }, themes.filter((t) => t.still_url))?.still_url, "fallback still is the first usable gallery artifact");
assert(catalogForChrome(themes).includes("Golden Shovel portrait"), "Chrome catalog lists gallery titles");
assert(parseChromeThemeMatch("Use Golden Shovel portrait", themes)?.asset_id === "ref-2", "Chrome title match binds the gallery artifact");
assert(parseChromeThemeMatch("no match", []) === null, "empty catalogue does not invent a still");

console.log("gallery-theme.test.mjs: ok");
