"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CURATE_STUDIO_HREF } from "@/lib/assemble/studio";

export type CurateUniverseOption = {
  master_id: string;
  title: string | null;
};

export function CurateUniverseSelect({
  universes,
  selectedUniverseId,
}: {
  universes: CurateUniverseOption[];
  selectedUniverseId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Canonical work
      </span>
      <select
        value={selectedUniverseId ?? ""}
        aria-label="Select Universe for Curate Studio"
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.value) params.set("universe", event.target.value);
          else params.delete("universe");
          const query = params.toString();
          router.push(query ? `${CURATE_STUDIO_HREF}?${query}` : CURATE_STUDIO_HREF);
        }}
        className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm"
      >
        <option value="">Not associated yet…</option>
        {universes.map((universe) => (
          <option key={universe.master_id} value={universe.master_id}>
            {universe.title ?? universe.master_id.slice(0, 8)}
          </option>
        ))}
      </select>
    </label>
  );
}
