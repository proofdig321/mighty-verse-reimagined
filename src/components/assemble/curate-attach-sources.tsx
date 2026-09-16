"use client";

import { useMemo, useState } from "react";
import { AssociateWithUniverse } from "@/components/assemble/associate-with-universe";
import { GallerySourcePicker } from "@/components/assemble/gallery-source-picker";
import { playableGallerySources } from "@/lib/assemble/gallery-source";
import type { CurateStudioUniverse } from "@/lib/assemble/load-studio";
import type { CurateStudioMedia } from "@/lib/assemble/studio";

export function CurateAttachSources({
  media,
  universes,
  lockedUniverseId,
  initialAssetId,
}: {
  media: CurateStudioMedia[];
  universes: CurateStudioUniverse[];
  lockedUniverseId: string;
  initialAssetId: string | null;
}) {
  const sources = useMemo(() => playableGallerySources(media), [media]);
  const [selectedId, setSelectedId] = useState<string | null>(initialAssetId ?? sources[0]?.asset_id ?? null);
  const selected = media.find((item) => item.asset_id === selectedId) ?? null;
  const target = universes.find((universe) => universe.master_id === lockedUniverseId) ?? null;

  return (
    <div className="space-y-5">
      <GallerySourcePicker
        sources={sources}
        selectedId={selectedId}
        onSelect={setSelectedId}
        label="Gallery media already ingested"
      />
      {selected && target ? (
        <AssociateWithUniverse
          key={selected.asset_id}
          media={selected}
          universes={[target]}
          defaultOpen
          lockedUniverseId={lockedUniverseId}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Select gallery media above, or add a new file through intake if it is not in the gallery yet.
        </p>
      )}
    </div>
  );
}
