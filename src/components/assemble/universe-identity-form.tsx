"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
    <form onSubmit={handleSubmit} className="max-w-3xl" aria-labelledby="universe-identity-form-title">
      <Card>
        <CardHeader className="border-b">
          <CardTitle id="universe-identity-form-title">Canonical identity</CardTitle>
          <CardDescription>
            Title and description name this Universe. They are not the public Experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="universe-title">Title</Label>
            <Input
              id="universe-title"
              name="title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (fieldError) setFieldError(null);
              }}
              placeholder="Universe title"
              disabled={busy}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "universe-title-error" : "universe-title-hint"}
              autoComplete="off"
            />
            <p id="universe-title-hint" className="text-xs text-muted-foreground">
              Required. This is the name shown in curation and discovery.
            </p>
            {fieldError && (
              <p id="universe-title-error" role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="universe-description">Description</Label>
            <Textarea
              id="universe-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="How this Universe is introduced"
              disabled={busy}
              rows={4}
              aria-describedby="universe-description-hint"
            />
            <p id="universe-description-hint" className="text-xs text-muted-foreground">
              Optional. Plain-language introduction for this Universe.
            </p>
          </div>
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : saveLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
