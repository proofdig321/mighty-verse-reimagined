/**
 * StudioFeedback — canonical inline feedback message for authority workspace surfaces.
 * Replaces repeated inline conditional class patterns for error/success messages.
 */
export function StudioFeedback({ message }: { message: string | null }) {
  if (!message) return null;
  const isError =
    message.startsWith("Error") ||
    message.includes("not granted") ||
    message.includes("could not");
  return (
    <p
      role="status"
      className={`text-sm ${isError ? "text-destructive" : "text-emerald-400"}`}
    >
      {message}
    </p>
  );
}
