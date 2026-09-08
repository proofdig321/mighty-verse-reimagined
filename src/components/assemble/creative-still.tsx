import { cn } from "@/lib/utils";

/**
 * Still presence for Studio objects. Not a player, not invented artwork.
 * Missing media renders a cinematic placeholder rather than a fake image.
 */
export function CreativeStill({
  url,
  alt,
  className,
}: {
  url: string | null;
  alt: string;
  className?: string;
}) {
  if (!url) {
    return <div className={cn("suite-still-placeholder", className)} aria-hidden="true" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={cn("suite-still", className)} />
  );
}
