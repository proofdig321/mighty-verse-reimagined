"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validateUniverseIdentity, type UniverseIdentity } from "@/lib/assemble/identity";

export type UniverseIdentityFormProps = {
  initialTitle: string;
  initialDescription: string;
  onSave: (identity: UniverseIdentity) => Promise<{ error?: string } | void>;
  onCancel: () => void;
  saveLabel?: string;
};

export default function UniverseIdentityForm({
  initialTitle,
  initialDescription,
  onSave,
  onCancel,
  saveLabel = "Save identity",
}: UniverseIdentityFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    const result = validateUniverseIdentity({ title, description });
    if (!result.ok) {
      setFieldError(result.error);
      return;
    }
    setFieldError(null);
    setBusy(true);
    const response = await onSave(result.value);
    setBusy(false);
    if (response?.error) setSaveError(response.error);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl"
      aria-labelledby="universe-identity-form-title"
    >
      <div className="studio-composer">
        <div className="space-y-0.5">
          <p className="suite-kicker" id="universe-identity-form-title">Canonical identity</p>
          <p className="text-xs text-muted-foreground">
            Title and description name this Universe. They are not the public Experience.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="universe-title" className="suite-kicker normal-case tracking-normal">Title</Label>
          <Input
            id="universe-title"
            name="title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (fieldError) setFieldError(null); }}
            placeholder="Universe title"
            disabled={busy}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "universe-title-error" : "universe-title-hint"}
            autoComplete="off"
            className="bg-background/60"
          />
          <p id="universe-title-hint" className="text-xs text-muted-foreground">
            Required. Shown in curation and discovery.
          </p>
          {fieldError && (
            <p id="universe-title-error" role="alert" className="text-xs text-destructive">
              {fieldError}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="universe-description" className="suite-kicker normal-case tracking-normal">Description</Label>
          <Textarea
            id="universe-description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="How this Universe is introduced"
            disabled={busy}
            rows={4}
            aria-describedby="universe-description-hint"
            className="bg-background/60 resize-none"
          />
          <p id="universe-description-hint" className="text-xs text-muted-foreground">
            Optional. Plain-language introduction.
          </p>
        </div>

        {saveError && (
          <p role="alert" className="text-xs text-destructive">{saveError}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
