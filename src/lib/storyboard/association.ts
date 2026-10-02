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
