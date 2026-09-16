"use client";

import { RESET_SCOPES, resetScopeCopy, type ResetScope } from "@/lib/storyboard/mutations";
import { Button } from "@/components/ui/button";

export function StoryboardResetDialog({
  open,
  panelSelected,
  onClose,
  onConfirm,
}: {
  open: boolean;
  panelSelected: boolean;
  onClose: () => void;
  onConfirm: (scope: ResetScope) => void;
}) {
  if (!open) return null;
  return (
    <div className="storyboard-dialog-backdrop" role="presentation" onClick={onClose}>
      <form
        role="dialog"
        aria-labelledby="storyboard-reset-title"
        className="storyboard-dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const scope = String(data.get("scope") || "unsaved") as ResetScope;
          onConfirm(scope);
        }}
      >
        <h2 id="storyboard-reset-title" className="text-lg font-semibold">Reset workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reset never silently destroys the Storyboard. Choose a scope. Canonical Scenes are not affected.
        </p>
        <fieldset className="mt-4 grid gap-3">
          {RESET_SCOPES.filter((scope) => panelSelected || (scope !== "panel" && scope !== "panel-artifacts")).map((scope) => {
            const copy = resetScopeCopy(scope);
            return (
              <label key={scope} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                <input type="radio" name="scope" value={scope} defaultChecked={scope === "unsaved"} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium">{copy.title}</span>
                  <span className="block text-xs text-muted-foreground">{copy.body}</span>
                  {copy.destructive ? <span className="mt-1 block text-[11px] text-destructive">This is a destructive choice.</span> : null}
                </span>
              </label>
            );
          })}
        </fieldset>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Reset</Button>
        </div>
      </form>
    </div>
  );
}
