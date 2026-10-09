import type { ReactNode } from "react";

/**
 * StudioField — canonical labeled form field for authority workspace surfaces.
 * Replaces repeated inline label + input/textarea/select + hint patterns.
 */
export function StudioField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <label className="studio-authoring-label">{label}</label>
      {children}
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Shared input class — use on <input> elements inside StudioField */
export const studioInputClass =
  "h-8 w-full rounded border border-input bg-background/60 px-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50";

/** Shared textarea class — use on <textarea> elements inside StudioField */
export const studioTextareaClass =
  "w-full rounded border border-input bg-background/60 px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50 resize-none";

/** Shared select class — use on <select> elements inside StudioField */
export const studioSelectClass =
  "h-8 w-full rounded border border-input bg-background/60 px-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50";
