import { muxPosterUrl, muxThumbnailUrl, resolveThumbnail } from "../thumbnail";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const JUDAS = "hqGacPkUZZuWiTu4kl9DZQx56IutFzfnXnsgDr1LHEM";
const SHE = "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4";

const poster = muxThumbnailUrl(JUDAS, 0, 640);
assert(!poster.includes("time="), "time=0 uses Mux representative poster, not the black first frame");
assert(poster === muxPosterUrl(JUDAS, 640), "poster helper matches omit-time thumbnail");
assert(poster.includes("width=640"), "poster can still set width");

const zero = muxThumbnailUrl(JUDAS);
assert(zero === `https://image.mux.com/${JUDAS}/thumbnail.jpg`, "bare poster has no query");

const powerhouse = muxThumbnailUrl(SHE, 36, 640);
assert(powerhouse.includes("time=36"), "Powerhouse still stays timed at 36s");
assert(muxThumbnailUrl(SHE, 80).includes("time=80"), "Dark Knight still stays timed at 80s");
assert(muxThumbnailUrl(SHE, 149).includes("time=149"), "Hand-to-Hand still stays timed at 149s");
assert(muxThumbnailUrl(SHE, 193).includes("time=193"), "Sword Master still stays timed at 193s");

const mural = resolveThumbnail({ playbackId: SHE, startMs: 0, provider: "mux" });
assert(mural && !mural.includes("time="), "Mux mural with start 0 uses poster");
const scene = resolveThumbnail({ playbackId: SHE, startMs: 36000, provider: "mux" });
assert(scene && scene.includes("time=36"), "Mux Scene stills keep canonical seconds");

console.log("Mux thumbnail/poster tests: all passed");
