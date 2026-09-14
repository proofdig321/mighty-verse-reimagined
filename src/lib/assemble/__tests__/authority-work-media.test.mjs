import { muxHlsEndpoint, isPlayableBoundMedia, toAuthorityProjectionMedia } from "../authority-work-media";
import { canWithdrawMaster } from "../withdraw";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const FR_PLAYBACK = "014sJhmHHRL2g52G14xG00L6MTyq4zvunCsZtFStk4Wds";
const FR_MURAL = "14938419-9477-431a-be04-511b1e205bbd";
const SHE_MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";

assert(
  muxHlsEndpoint(FR_PLAYBACK) === `https://stream.mux.com/${FR_PLAYBACK}.m3u8`,
  "Mux HLS is derived from the stored playback id",
);

const bound = {
  binding_type: "primary",
  access_level: "public",
  start_ms: null,
  end_ms: null,
  media_asset: {
    storage_ref: FR_PLAYBACK,
    asset_type: "original",
    provider: "mux",
  },
};

assert(isPlayableBoundMedia(bound) === true, "Father Raymond mural bind is playable");
const media = toAuthorityProjectionMedia(bound);
assert(media?.playback_id === FR_PLAYBACK, "projection media keeps the Mux playback id");
assert(media?.endpoint_ref?.includes(FR_PLAYBACK) === true, "projection media has a Mux HLS endpoint");
assert(media?.media_class === "video", "original Mux animation plays as video");
assert(toAuthorityProjectionMedia(null) === null, "missing bind has no player");
assert(
  isPlayableBoundMedia({
    ...bound,
    media_asset: { storage_ref: "seed:placeholder:x", asset_type: "original", provider: "mux" },
  }) === false,
  "placeholder storage is not playable",
);

assert(canWithdrawMaster(FR_MURAL, "state") === true, "Father Raymond mural can be withdrawn from the record");
assert(canWithdrawMaster(SHE_MURAL, "state") === false, "Super Hero Ego mural cannot be withdrawn");
assert(canWithdrawMaster(FR_MURAL, null) === false, "already withdrawn mural has no withdraw act");

console.log("authority-work-media.test.mjs: ok");
