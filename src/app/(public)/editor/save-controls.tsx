"use client";

import { useState } from "react";
import { Save, Check, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssemblyItem } from "./types";

type SavedDeck = { deck_id: string; name: string; updated_at: string };

type Props = {
  deckName: string;
  onNameChange: (name: string) => void;
  deckId: string | null;
  assembly: AssemblyItem[];
  savedDecks: SavedDeck[];
  onSave: () => Promise<void>;
  onLoadDeck: (deckId: string) => void;
  isAuthenticated: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SaveControls({
  deckName, onNameChange, deckId, assembly, savedDecks, onSave, onLoadDeck, isAuthenticated,
}: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showDecks, setShowDecks] = useState(false);

  async function handleSave() {
    if (!isAuthenticated || assembly.length === 0) return;
    setSaveState("saving");
    try {
      await onSave();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  return (
    <div className="border-t border-border bg-card/50 px-4 py-3 space-y-3">
      {/* Deck name */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={deckName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Name your experience…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-[var(--accent-mv)] placeholder:text-muted-foreground"
          maxLength={80}
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isAuthenticated || assembly.length === 0 || saveState === "saving"}
          style={{ background: saveState === "saved" ? "var(--accent-mv)" : undefined }}
        >
          {saveState === "saving" && <Loader2 size={13} className="animate-spin" />}
          {saveState === "saved" && <Check size={13} />}
          {saveState === "idle" && <Save size={13} />}
          {saveState === "error" && <Save size={13} />}
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Failed" : deckId ? "Update" : "Save"}
        </Button>
      </div>

      {!isAuthenticated && (
        <p className="text-xs text-muted-foreground">
          <a href="/auth/sign-in" className="underline hover:text-foreground">Sign in</a> to save your experience.
        </p>
      )}

      {saveState === "error" && (
        <p className="text-xs text-destructive">Save failed. Please try again.</p>
      )}

      {/* My saved experiences */}
      {isAuthenticated && savedDecks.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDecks(v => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown size={12} className={`transition-transform ${showDecks ? "rotate-180" : ""}`} />
            My saved experiences ({savedDecks.length})
          </button>
          {showDecks && (
            <div className="mt-2 space-y-1">
              {savedDecks.map(d => (
                <button
                  key={d.deck_id}
                  type="button"
                  onClick={() => { onLoadDeck(d.deck_id); setShowDecks(false); }}
                  className="w-full flex items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-accent/50 transition-colors"
                  style={{ border: d.deck_id === deckId ? "1px solid var(--accent-mv)" : "1px solid transparent" }}
                >
                  <span className="font-medium text-foreground truncate">{d.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {new Date(d.updated_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
