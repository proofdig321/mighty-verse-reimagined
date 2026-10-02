export function storyboardAssociationStatus(universeId: string | null): {
  attached: boolean;
  required: boolean;
  label: string;
  badgeVariant: "default" | "outline" | "secondary";
} {
  if (!universeId) {
    return {
      attached: false,
      required: true,
      label: "Standalone work",
      badgeVariant: "outline",
    };
  }

  return {
    attached: true,
    required: false,
    label: "Attached to universe",
    badgeVariant: "default",
  };
}

export function storyboardGenerationStatusLabel(value?: string | null): string {
  switch (value) {
    case "generating":
      return "Generating";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    case "queued":
      return "Queued";
    case "blocked":
      return "Blocked";
    case "idle":
      return "Idle";
    case "unavailable":
      return "Unavailable";
    default:
      return "Waiting";
  }
}

export function storyboardUpdatedLabel(value?: string | null): string {
  if (!value) return "Not updated yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not updated yet";
  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "Updated just now";
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `Updated ${diffDays}d ago`;
}

export function storyboardWorkSummary({
  universeId,
  generationStatus,
  updatedAt,
  panelCount,
}: {
  universeId: string | null;
  generationStatus?: string | null;
  updatedAt?: string | null;
  panelCount: number;
}): {
  status: string;
  generation: string;
  line: string;
} {
  const association = storyboardAssociationStatus(universeId);
  const generation = storyboardGenerationStatusLabel(generationStatus);
  return {
    status: association.label,
    generation,
    line: `${panelCount} panels · ${generation} · ${storyboardUpdatedLabel(updatedAt)}`,
  };
}
