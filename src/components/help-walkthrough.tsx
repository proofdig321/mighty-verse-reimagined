"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    title: "Discover",
    href: "/universes",
    linkLabel: "Open Universes",
    script:
      "Discover. Start on Home, then open Universes. A Universe is the canonical work. Mighty Verse is not a folder of video files. You are looking at creative identity first.",
    body: "Home and Universes show that a work exists before you manipulate it. Super Hero Ego is the live reference Universe.",
  },
  {
    title: "Reveal",
    href: "/murals",
    linkLabel: "Open Murals",
    script:
      "Reveal. Open a Mural, then Scenes, then Creative Moments. The Mural is the full audiovisual expression. Scenes have canonical timing. Creative Moments are contributor units, and one Moment can appear in more than one Scene.",
    body: "Murals, Scenes, Gallery, and Participants deepen understanding. Shuffle on Scene Deck is presentation only. It does not rewrite canonical order.",
  },
  {
    title: "Assemble",
    href: "/scenes",
    linkLabel: "Open Scene Deck",
    script:
      "Assemble. On Scenes, flip cards, add them to your custom sequence, and play that timeline. Build Experience opens the timeline editor. Storyboard lets you generate shots from gallery artifacts and a thirty second clip. Creative Studio is for authorised production.",
    body: "Scene Deck, Timeline editor, and audience Storyboard are Experience assembly. They do not create Scenes or change Super Hero Ego timing.",
  },
  {
    title: "Experience",
    href: "/universes?intent=experience",
    linkLabel: "Enter Experience",
    script:
      "Experience. Choose a Universe, then enter the holographic cinema. Cursor movement warps the picture and pans the sound. This is how the work is presented. It does not become the source of truth.",
    body: "The public Experience consumes projections. Media is not the creative work. Mux is delivery infrastructure.",
  },
  {
    title: "Operations",
    href: "/authority",
    linkLabel: "Open Dashboard",
    script:
      "Operations. The dashboard is gated. Authority holders Create, Curate, manage Participants, and run Creative Studio. Audience pages stay public. Dashboard pages stay operational.",
    body: "Connect to enter Studio or Dashboard. Registering a participant does not assign rights. Sentinel observes. It does not decide meaning.",
  },
] as const;

export function HelpWalkthrough() {
  const [index, setIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  function speakFrom(start: number) {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const remaining = STEPS.slice(start);
    if (remaining.length === 0) {
      setSpeaking(false);
      return;
    }
    setIndex(start);
    setSpeaking(true);
    remaining.forEach((step, offset) => {
      const utterance = new SpeechSynthesisUtterance(step.script);
      utterance.rate = 0.95;
      utterance.onstart = () => setIndex(start + offset);
      utterance.onend = () => {
        if (start + offset === STEPS.length - 1) setSpeaking(false);
      };
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    });
  }

  function stop() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  const current = STEPS[index];

  return (
    <div className="public-page">
      <section className="public-hero">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-mv">Audience walkthrough</p>
          <h1 className="mt-3 text-4xl font-semibold md:text-5xl" style={{ fontFamily: "var(--font-display, inherit)" }}>
            How Mighty Verse works
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            A compact tour of Discover, Reveal, Assemble, and Experience. The browser narrator reads each step aloud.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" onClick={() => (speaking ? stop() : speakFrom(index))} disabled={!supported}>
              {speaking ? <Pause size={14} /> : <Play size={14} />}
              {speaking ? "Pause narrator" : "Play narrator"}
            </Button>
            <Button type="button" variant="outline" onClick={stop} disabled={!supported || !speaking}>
              <Square size={14} />
              Stop
            </Button>
            {!supported ? <p className="text-sm text-muted-foreground">This browser does not expose speech synthesis.</p> : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
        <ol className="grid gap-4 md:grid-cols-2">
          {STEPS.map((step, stepIndex) => (
            <li key={step.title}>
              <button type="button" className="w-full text-left" onClick={() => { setIndex(stepIndex); if (speaking) speakFrom(stepIndex); }}>
                <Card className={stepIndex === index ? "ring-1 ring-primary bg-card" : "bg-card/70"}>
                  <CardHeader>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Step {String(stepIndex + 1).padStart(2, "0")}
                    </p>
                    <CardTitle>{step.title}</CardTitle>
                    <CardDescription>{step.body}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link href={step.href} className="text-sm font-medium underline-offset-4 hover:underline">
                      {step.linkLabel}
                    </Link>
                  </CardContent>
                </Card>
              </button>
            </li>
          ))}
        </ol>
        <aside className="rounded-xl border border-border bg-card/60 p-5" aria-live="polite">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Now reading</p>
          <h2 className="mt-1 text-lg font-medium">{current.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{current.script}</p>
        </aside>
      </div>
    </div>
  );
}
