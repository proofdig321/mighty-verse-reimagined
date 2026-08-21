type Props = {
  artworkUrl: string | null;
  alt?: string;
  aspectRatio?: "1/1" | "2/3" | "16/9";
};

export default function ArtworkFrame({ artworkUrl, alt = "", aspectRatio = "1/1" }: Props) {
  return (
    <div
      style={{ aspectRatio, position: "relative", overflow: "hidden" }}
      className="w-full bg-background border border-border"
    >
      {artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={artworkUrl}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        // Deliberate empty state — artwork slot is present but not yet filled
        <div
          className="absolute inset-0 flex items-end p-4"
          style={{ background: "linear-gradient(135deg, oklch(0.14 0 0) 0%, oklch(0.10 0 0) 100%)" }}
        >
          <span className="text-xs uppercase tracking-widest text-muted-foreground/40 select-none">
            Artwork
          </span>
        </div>
      )}
    </div>
  );
}
