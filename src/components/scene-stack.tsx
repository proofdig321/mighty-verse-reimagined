"use client";

import Link from "next/link";
import { useState } from "react";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SceneStackItem = {
  id: string;
  title: string | null;
  href?: string;
  playbackId?: string | null;
};

type Props = {
  scenes: SceneStackItem[];
};

// Deterministic per-card offsets so the stack looks physical
const OFFSETS = [
  { rotate: "-4deg", x: "-6px", y: "0px" },
  { rotate: "2.5deg", x: "4px", y: "-3px" },
  { rotate: "-1.5deg", x: "-2px", y: "-6px" },
  { rotate: "3.5deg", x: "6px", y: "-9px" },
  { rotate: "-3deg", x: "-4px", y: "-12px" },
];

function shuffleArr<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export default function SceneStack({ scenes }: Props) {
  const [deck, setDeck] = useState(scenes);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [drawn, setDrawn] = useState<SceneStackItem[]>([]);

  const topCard = deck[deck.length - 1] ?? null;

  function drawTop() {
    if (!topCard) return;
    setRevealed((r) => [...r, topCard.id]);
    setDeck((d) => d.slice(0, -1));
    setDrawn((d) => [topCard, ...d]);
  }

  function reset() {
    setDeck(scenes);
    setRevealed([]);
    setDrawn([]);
  }

  // How many cards to show in the stack (ghost layers behind top)
  const visibleStack = deck.slice(-5).reverse(); // top-first

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-12">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-1">Section 04</p>
          <h1
            className="text-4xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            Scene Deck
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Draw cards to reveal scenes. Shuffle to randomise the order.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setDeck(shuffleArr(scenes)); setRevealed([]); setDrawn([]); }}
          >
            <Dices size={14} />
            Shuffle
          </Button>
          {drawn.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-16 items-start">

        {/* Stack */}
        <div className="flex flex-col items-center gap-6 shrink-0">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {deck.length} card{deck.length !== 1 ? "s" : ""} remaining
          </p>

          {/* Physical stack */}
          <div
            className="relative"
            style={{ width: "clamp(14rem, 22vw, 18rem)", height: "clamp(19rem, 30vw, 24rem)" }}
          >
            {deck.length === 0 ? (
              <div
                className="absolute inset-0 rounded-lg border border-dashed flex items-center justify-center"
                style={{ borderColor: "color-mix(in oklch, var(--accent-mv) 30%, transparent)" }}
              >
                <p className="text-xs text-muted-foreground">Deck empty</p>
              </div>
            ) : (
              visibleStack.map((scene, layerIndex) => {
                const isTop = layerIndex === 0;
                const off = OFFSETS[Math.min(layerIndex, OFFSETS.length - 1)];
                // Layers behind top are slightly smaller and darker
                const scale = 1 - layerIndex * 0.025;
                const zIndex = visibleStack.length - layerIndex;

                return (
                  <div
                    key={scene.id}
                    className="absolute inset-0 rounded-lg border overflow-hidden"
                    style={{
                      zIndex,
                      transform: isTop
                        ? "none"
                        : `rotate(${off.rotate}) translate(${off.x}, ${off.y}) scale(${scale})`,
                      transformOrigin: "bottom center",
                      borderColor: isTop
                        ? "color-mix(in oklch, var(--accent-mv) 70%, transparent)"
                        : "color-mix(in oklch, var(--accent-mv) 35%, transparent)",
                      background: isTop
                        ? "linear-gradient(135deg, color-mix(in oklch, var(--accent-mv) 28%, var(--card)), var(--card))"
                        : `color-mix(in oklch, var(--card) ${85 + layerIndex * 3}%, transparent)`,
                      boxShadow: isTop
                        ? "0 20px 40px color-mix(in oklch, var(--background) 30%, transparent), 8px 12px 0 color-mix(in oklch, var(--background) 55%, transparent)"
                        : "none",
                      transition: "transform 200ms ease",
                    }}
                  >
                    {/* Inner border decoration */}
                    <span
                      className="absolute pointer-events-none"
                      style={{
                        inset: "0.65rem",
                        border: `1px solid color-mix(in oklch, var(--accent-mv) ${isTop ? 55 : 25}%, transparent)`,
                      }}
                    />
                    <span
                      className="absolute pointer-events-none"
                      style={{
                        inset: "1.1rem",
                        border: `1px solid color-mix(in oklch, var(--accent-mv) ${isTop ? 30 : 12}%, transparent)`,
                        transform: "rotate(45deg) scale(0.72)",
                      }}
                    />

                    {/* MV mark */}
                    <span
                      className="absolute"
                      style={{
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        color: `color-mix(in oklch, var(--accent-mv) ${isTop ? 100 : 40}%, transparent)`,
                        fontFamily: "var(--font-display, inherit)",
                        fontSize: "2rem",
                        letterSpacing: "0.2em",
                        fontWeight: 700,
                      }}
                    >
                      MV
                    </span>

                    {/* Scene number on top card */}
                    {isTop && (
                      <span
                        className="absolute left-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          background: "color-mix(in oklch, var(--accent-mv) 30%, var(--background))",
                          color: "var(--accent-mv)",
                          border: "1px solid color-mix(in oklch, var(--accent-mv) 50%, transparent)",
                        }}
                      >
                        {String(deck.length).padStart(2, "0")}
                      </span>
                    )}

                    {/* Tap to reveal — top card only */}
                    {isTop && (
                      <button
                        type="button"
                        onClick={drawTop}
                        className="absolute inset-0 w-full h-full flex flex-col items-center justify-end pb-6 cursor-pointer"
                        aria-label="Draw top card"
                      >
                        <span
                          className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                          style={{ color: "color-mix(in oklch, var(--accent-mv) 60%, transparent)" }}
                        >
                          Tap to draw
                        </span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Drawn cards — revealed hand */}
        <div className="flex-1 min-w-0">
          {drawn.length === 0 ? (
            <div className="flex items-center justify-center h-48 rounded-lg border border-dashed"
              style={{ borderColor: "color-mix(in oklch, var(--accent-mv) 20%, transparent)" }}
            >
              <p className="text-sm text-muted-foreground">Draw a card to reveal a scene</p>
            </div>
          ) : (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
                {drawn.length} drawn
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {drawn.map((scene, i) => {
                  const card = (
                    <div
                      className="relative rounded-lg border overflow-hidden"
                      style={{
                        aspectRatio: "3/4",
                        borderColor: "color-mix(in oklch, var(--accent-mv) 60%, transparent)",
                        background: "linear-gradient(135deg, color-mix(in oklch, var(--accent-mv) 25%, var(--card)), var(--card))",
                      }}
                    >
                      {/* Inner border */}
                      <span className="absolute pointer-events-none" style={{ inset: "0.5rem", border: "1px solid color-mix(in oklch, var(--accent-mv) 45%, transparent)" }} />

                      {/* Number */}
                      <span
                        className="absolute left-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: "var(--accent-mv-gold)", color: "#000" }}
                      >
                        {String(drawn.length - i).padStart(2, "0")}
                      </span>

                      {/* Title */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                        <p className="text-xs font-semibold text-white leading-tight">
                          {scene.title ?? `Scene ${drawn.length - i}`}
                        </p>
                      </div>
                    </div>
                  );

                  return scene.href ? (
                    <Link key={scene.id} href={scene.href} className="block hover:opacity-90 transition-opacity">
                      {card}
                    </Link>
                  ) : (
                    <div key={scene.id}>{card}</div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
