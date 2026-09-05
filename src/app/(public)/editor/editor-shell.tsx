"use client";

import { useState, useCallback } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import SceneLibrary from "./scene-library";
import AssemblyCanvas from "./assembly-canvas";
import SaveControls from "./save-controls";
import TimelinePlayer from "./timeline-player";
import type { LibraryScene, AssemblyItem, PlaybackSegment } from "./types";

type SavedDeck = { deck_id: string; name: string; updated_at: string; user_deck_item?: { item_id: string; projection_id: string; sort_order: number }[] };

type Props = {
  scenes: LibraryScene[];
  initialDecks: SavedDeck[];
  isAuthenticated: boolean;
};

let keyCounter = 0;
function nextKey() { return `item-${++keyCounter}`; }

export default function EditorShell({ scenes, initialDecks, isAuthenticated }: Props) {
  const [assembly, setAssembly] = useState<AssemblyItem[]>([]);
  const [deckName, setDeckName] = useState("My Experience");
  const [deckId, setDeckId] = useState<string | null>(null);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(initialDecks);
  const [playerSegments, setPlayerSegments] = useState<PlaybackSegment[] | null>(null);

  // Add a scene to the assembly
  function addScene(scene: LibraryScene) {
    const item: AssemblyItem = {
      key: nextKey(),
      projectionId: scene.projectionId,
      title: scene.title,
      thumbnailUrl: scene.thumbnailUrl,
      playbackId: scene.playbackId,
      provider: scene.provider,
      hlsUrl: scene.hlsUrl,
      startMs: scene.startMs,
      endMs: scene.endMs,
      durationSec: scene.durationSec,
    };
    setAssembly(prev => [...prev, item]);
  }

  function removeItem(key: string) {
    setAssembly(prev => prev.filter(i => i.key !== key));
  }

  function reorder(items: AssemblyItem[]) {
    setAssembly(items);
  }

  // Build playback segments from assembly, starting at a given index
  function buildSegments(startIdx = 0): PlaybackSegment[] {
    return assembly
      .slice(startIdx)
      .filter(i => i.playbackId && i.startMs != null && i.endMs != null)
      .map(i => ({
        projectionId: i.projectionId,
        title: i.title,
        playbackId: i.playbackId!,
        provider: i.provider,
        hlsUrl: i.hlsUrl,
        startMs: i.startMs!,
        endMs: i.endMs!,
      }));
  }

  function playFrom(idx: number) {
    const segs = buildSegments(idx);
    if (segs.length > 0) setPlayerSegments(segs);
  }

  // Save / update deck
  const handleSave = useCallback(async () => {
    const items = assembly.map((item, i) => ({ projection_id: item.projectionId, sort_order: i }));

    if (deckId) {
      // Update existing
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deckName, items }),
      });
      if (!res.ok) throw new Error("Save failed");
    } else {
      // Create new
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deckName, items }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setDeckId(data.deck_id);
      // Refresh deck list
      const listRes = await fetch("/api/decks");
      if (listRes.ok) {
        const { decks } = await listRes.json();
        setSavedDecks(decks ?? []);
      }
    }
  }, [assembly, deckId, deckName]);

  // Load an existing deck
  async function loadDeck(id: string) {
    const res = await fetch(`/api/decks/${id}`);
    if (!res.ok) return;
    const deck = await res.json() as SavedDeck;

    const sortedItems = (deck.user_deck_item ?? []).sort((a, b) => a.sort_order - b.sort_order);
    const newAssembly: AssemblyItem[] = sortedItems.map(item => {
      const scene = scenes.find(s => s.projectionId === item.projection_id);
      return {
        key: nextKey(),
        projectionId: item.projection_id,
        title: scene?.title ?? null,
        thumbnailUrl: scene?.thumbnailUrl ?? null,
        playbackId: scene?.playbackId ?? null,
        provider: scene?.provider ?? null,
        hlsUrl: scene?.hlsUrl ?? null,
        startMs: scene?.startMs ?? null,
        endMs: scene?.endMs ?? null,
        durationSec: scene?.durationSec ?? null,
      };
    });

    setAssembly(newAssembly);
    setDeckName(deck.name);
    setDeckId(deck.deck_id);
  }

  const canPlay = assembly.some(i => i.playbackId && i.startMs != null && i.endMs != null);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: "var(--accent-mv)" }}>
            Mighty Verse
          </span>
          <span className="text-muted-foreground text-xs">/</span>
          <span className="text-sm font-medium text-foreground">Experience Editor</span>
        </div>
        <Button
          size="sm"
          disabled={!canPlay}
          onClick={() => playFrom(0)}
          style={{ background: canPlay ? "var(--accent-mv)" : undefined }}
        >
          <Play size={13} />
          Play Experience
        </Button>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0">

        {/* Left: Scene Library */}
        <div className="w-64 xl:w-72 shrink-0 border-r border-border flex flex-col min-h-0">
          <SceneLibrary scenes={scenes} assembly={assembly} onAdd={addScene} />
        </div>

        {/* Centre: Assembly Canvas + Save Controls */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="flex-1 min-h-0">
            <AssemblyCanvas
              items={assembly}
              onReorder={reorder}
              onRemove={removeItem}
              onPreview={playFrom}
            />
          </div>
          <SaveControls
            deckName={deckName}
            onNameChange={setDeckName}
            deckId={deckId}
            assembly={assembly}
            savedDecks={savedDecks}
            onSave={handleSave}
            onLoadDeck={loadDeck}
            isAuthenticated={isAuthenticated}
          />
        </div>

      </div>

      {/* Timeline player overlay */}
      {playerSegments && (
        <TimelinePlayer
          segments={playerSegments}
          onClose={() => setPlayerSegments(null)}
        />
      )}
    </div>
  );
}
