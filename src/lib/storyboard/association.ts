export function storyboardAssociationStatus(universeId: string | null): {
  attached: boolean;
  required: boolean;
  label: string;
} {
  if (!universeId) {
    return {
      attached: false,
      required: true,
      label: "Standalone work",
    };
  }

  return {
    attached: true,
    required: false,
    label: "Attached to universe",
  };
}
