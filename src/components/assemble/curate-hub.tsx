import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { CurateHubRow, CurateHubSnapshot } from "@/lib/assemble/curate-hub";
import { RegisterCreativeMoment } from "./register-creative-moment";
import { RegisterMural } from "./register-mural";

function toneClass(tone: CurateHubRow["tone"]) {
  if (tone === "complete") return "border-emerald-500/40 bg-emerald-500/10";
  if (tone === "attention") return "border-amber-500/40 bg-amber-500/10";
  if (tone === "processing") return "border-[color-mix(in_oklch,var(--accent-mv)_45%,transparent)] bg-[color-mix(in_oklch,var(--accent-mv)_10%,var(--card))]";
  return "border-border bg-card/40";
}

function toneLabel(tone: CurateHubRow["tone"]) {
  if (tone === "complete") return "Complete";
  if (tone === "attention") return "Needs you";
  if (tone === "processing") return "In progress";
  return "Pending";
}

export function CurateHub({ snapshot }: { snapshot: CurateHubSnapshot }) {
  return (
    <section className="space-y-6" aria-labelledby="curate-hub-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Curate Hub
          </p>
          <h2
            id="curate-hub-heading"
            className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            {snapshot.universeTitle}
          </h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Here is the work. Here is what is true. Here is what needs your attention.
            Sentinel observes. You decide canonical meaning.
          </p>
        </div>
        <Link
          href={snapshot.nextAction.href}
          className={buttonVariants({ size: "sm" })}
        >
          {snapshot.nextAction.label}
        </Link>
      </div>

      {snapshot.processingNote && (
        <p
          role="status"
          className="rounded-lg border border-[color-mix(in_oklch,var(--accent-mv)_40%,transparent)] bg-[color-mix(in_oklch,var(--accent-mv)_8%,var(--card))] px-4 py-3 text-sm text-foreground"
        >
          {snapshot.processingNote}
        </p>
      )}

      <div className="rounded-xl border border-border bg-card px-5 py-5 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Next
        </p>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          {snapshot.nextAction.title}
        </h3>
        <p className="text-sm text-muted-foreground max-w-3xl">{snapshot.nextAction.body}</p>
        <Link href={snapshot.nextAction.href} className={buttonVariants()}>
          {snapshot.nextAction.label}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.rows.map((row) => (
          <article
            key={row.key}
            className={`rounded-xl border px-4 py-4 space-y-3 ${toneClass(row.tone)}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{row.label}</p>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {toneLabel(row.tone)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground min-h-10">{row.summary}</p>
            {row.href && row.actionLabel ? (
              <Link href={row.href} className="text-xs text-foreground hover:underline">
                {row.actionLabel}
              </Link>
            ) : null}
          </article>
        ))}
      </div>

      {!snapshot.muralRegistered && (
        <div
          id="register-mural"
          className="rounded-xl border border-border bg-card px-5 py-4 space-y-3"
        >
          <h3 className="text-sm font-medium text-foreground">Register Mural</h3>
          <p className="text-xs text-muted-foreground max-w-3xl">
            Establishes the audiovisual expression of this Universe. This is not minting and does
            not attach media.
          </p>
          <RegisterMural
            universeId={snapshot.universeId}
            universeTitle={snapshot.universeTitle}
            fromCurate
          />
        </div>
      )}

      <div
        id="register-moment"
        className="rounded-xl border border-border bg-card px-5 py-4 space-y-3"
      >
        <h3 className="text-sm font-medium text-foreground">Add Creative Moment</h3>
        <p className="text-xs text-muted-foreground max-w-3xl">
          Contributor-centred, parented to the Universe. Place it in Scenes from Creative Studio.
        </p>
        <RegisterCreativeMoment
          universeId={snapshot.universeId}
          universeTitle={snapshot.universeTitle}
        />
      </div>
    </section>
  );
}
