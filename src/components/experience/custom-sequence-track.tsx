"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTimelineMs } from "@/lib/media/timing";
import type { CustomSequenceItem } from "@/lib/experience/custom-sequence";

export function CustomSequenceTrack({
  items,
  onRemove,
  onClear,
}: {
  items: CustomSequenceItem[];
  onRemove: (slotId: string) => void;
  onClear: () => void;
}) {
  return (
    <Card className="mt-6 border-border/80 bg-card/60" data-custom-sequence-track="" data-sequence-count={items.length}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border/70 pb-4">
        <div className="min-w-0">
          <CardTitle>Interactive timeline composer</CardTitle>
          <CardDescription>
            Client sequence for flipped Scene cards. Shuffle still only rearranges the deck. This does not change canonical Scene order.
          </CardDescription>
        </div>
        {items.length > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            Clear sequence
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="pt-4">
        {items.length === 0 ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
            <h3 className="text-sm font-medium text-foreground">Sequence workspace is empty</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Flip a Scene card, then add it to this custom playback layout.
            </p>
          </div>
        ) : (
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {items.map((item, index) => (
              <li
                key={item.slotId}
                data-sequence-slot={item.slotId}
                className="overflow-hidden rounded-lg border border-border bg-background/60"
              >
                <div className="relative aspect-video bg-muted/40">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  <span className="absolute left-2 top-2 rounded border border-border bg-background/80 px-2 py-0.5 font-mono text-[10px] text-foreground">
                    {formatTimelineMs(item.startMs)}
                  </span>
                  <span className="absolute right-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <p className="truncate text-xs font-semibold text-foreground">{item.title}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    aria-label={`Remove ${item.title} from custom sequence`}
                    onClick={() => onRemove(item.slotId)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
