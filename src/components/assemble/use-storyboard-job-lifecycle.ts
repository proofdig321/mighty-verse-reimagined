"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { jobUiLabel } from "@/lib/ai/jobs";
import { operatorGenerationMessage } from "@/lib/storyboard/operator-error";

type GenerationState = {
  status: "idle" | "generating" | "ready" | "failed" | "unavailable" | "queued" | "blocked" | "needs_configuration";
  message: string;
};

export type StoryboardJobCard = {
  job_id: string;
  kind: string;
  status: string;
  progress: number | null;
  error: { message?: string } | null;
  result: { still_url?: string; endpoint_ref?: string; playback_id?: string; provider_video_uri?: string | null; has_audio?: boolean | null; asset_id?: string } | null;
  panel_id: string | null;
  retryable: boolean;
};

export function useStoryboardJobLifecycle({
  jobs,
  setJobs,
  setMediaState,
  setPanelStills,
}: {
  jobs: StoryboardJobCard[];
  setJobs: Dispatch<SetStateAction<StoryboardJobCard[]>>;
  setMediaState: Dispatch<SetStateAction<GenerationState>>;
  setPanelStills: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  const pendingJobId = jobs.find((job) =>
    job.status === "queued" || job.status === "submitted" || job.status === "processing",
  )?.job_id;

  useEffect(() => {
    if (!pendingJobId) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/authority/storyboard/jobs/${pendingJobId}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.job_id) return;

        setJobs((current) => current.map((job) => (job.job_id === payload.job_id ? payload : job)));
        if (payload.status === "completed" && payload.result?.still_url && payload.panel_id) {
          setPanelStills((current) => ({ ...current, [payload.panel_id]: payload.result.still_url }));
        }
        if (["completed", "failed", "unavailable", "blocked"].includes(payload.status)) {
          setMediaState({
            status: payload.status === "completed" ? "ready" : payload.status,
            message: payload.status === "completed"
              ? "Generation completed. The artifact is not a Scene."
              : operatorGenerationMessage(payload.error?.message ?? "Generation did not complete.").operator,
          });
        }
      } catch {
        // Keep the operation visible and try again on the next poll.
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [pendingJobId, setJobs, setMediaState, setPanelStills]);

  async function retryJob(jobId: string) {
    const response = await fetch(`/api/authority/storyboard/jobs/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.job_id) setJobs((current) => [payload, ...current.filter((job) => job.job_id !== payload.job_id)]);
  }

  async function cancelJob(jobId: string) {
    const response = await fetch(`/api/authority/storyboard/jobs/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.job_id) setJobs((current) => current.map((job) => job.job_id === payload.job_id ? payload : job));
  }

  return { retryJob, cancelJob };
}