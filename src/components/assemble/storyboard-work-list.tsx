"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { StoryboardWorkSummary } from "@/lib/storyboard/document";
import { StoryboardDeleteDialog } from "./storyboard-delete-dialog";
import { PaginatedItems } from "./collection-pager";

export function StoryboardWorkList({
  universes,
  initialWorks = [],
  standaloneOnly = false,
}: {
  universes: { master_id: string; title: string }[];
  initialWorks?: StoryboardWorkSummary[];
  standaloneOnly?: boolean;
}) {
  const router = useRouter();
  const [works, setWorks] = useState<StoryboardWorkSummary[]>(initialWorks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [pendingDelete, setPendingDelete] = useState<StoryboardWorkSummary | null>(null);

  async function refresh() {
    const response = await fetch("/api/authority/storyboard?list=1", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(payload.works)) {
      const next = payload.works as StoryboardWorkSummary[];
      setWorks(standaloneOnly ? next.filter((work) => !work.universe_id) : next);
    } else setError(payload.error ?? "Could not load storyboard works.");
    router.refresh();
  }

  async function createWork() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-work", title: "Untitled storyboard", universe_id: "" }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok || !payload.work?.work_id) {
      setError(payload.error ?? "Could not create a storyboard work.");
      return;
    }
    router.push(`/studio/work/${payload.work.work_id}`);
    router.refresh();
  }

  async function duplicate(workId: string) {
    setBusy(true);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate-work", work_id: workId }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (payload.work?.work_id) router.push(`/studio/work/${payload.work.work_id}`);
    else await refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-work", work_id: pendingDelete.work_id }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok || payload.deleted !== true) {
      setError(payload.error ?? "Storyboard could not be deleted.");
      return;
    }
    setWorks((current) => current.filter((work) => work.work_id !== pendingDelete.work_id));
    setPendingDelete(null);
    await refresh();
  }

  async function rename(workId: string) {
    if (!title.trim()) return;
    setBusy(true);
    await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", work_id: workId, title: title.trim() }),
    });
    setBusy(false);
    setRenaming(null);
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Standalone Storyboard Works stay independent until you attach a Universe. Creating work does not create Scenes.
        </p>
        <Button type="button" onClick={() => void createWork()} disabled={busy}>
          <Plus size={14} />
          New storyboard
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {works.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Storyboard Works yet</CardTitle>
            <CardDescription>Create a work to write, inspect source media, and generate stills or motion. Attachment is optional and explicit.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <PaginatedItems items={works} label="Storyboard works">
          {(page) => (
        <ul className="grid gap-3 md:grid-cols-2">
          {page.map((work) => (
            <li key={work.work_id}>
              <Card className="h-full bg-card/70">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="truncate text-base">{work.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{work.premise || "No description yet."}</CardDescription>
                    </div>
                    <Badge variant="outline">{work.attached ? "Attached" : "Unattached"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {work.panel_count} panels · {work.generation_status} · updated {new Date(work.updated_at).toLocaleString()}
                    {work.selected_still ? " · still selected" : ""}
                    {work.selected_motion ? " · motion selected" : ""}
                  </p>
                  {renaming === work.work_id ? (
                    <div className="flex gap-2">
                      <Input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Rename storyboard" />
                      <Button type="button" size="sm" onClick={() => void rename(work.work_id)}>Save</Button>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/studio/work/${work.work_id}`}>
                      <Button type="button" size="sm">
                        <FolderOpen size={13} />
                        Open
                      </Button>
                    </Link>
                    <Button type="button" size="sm" variant="outline" onClick={() => void duplicate(work.work_id)}>
                      <Copy size={13} />
                      Duplicate
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setRenaming(work.work_id); setTitle(work.title); }}>
                      <Pencil size={13} />
                      Rename
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setError(null);
                        setPendingDelete(work);
                      }}
                    >
                      <Trash2 size={13} />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
          )}
        </PaginatedItems>
      )}
      {universes.length ? (
        <p className="text-xs text-muted-foreground">
          Universe Storyboard remains under Creative Studio. This list is standalone work.
        </p>
      ) : null}
      <StoryboardDeleteDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.title ?? ""}
        attached={pendingDelete?.attached === true}
        busy={busy}
        error={error}
        onClose={() => {
          if (!busy) setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
