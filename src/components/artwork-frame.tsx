type Props = {
  artworkUrl: string | null;
  alt?: string;
  aspectRatio?: "1/1" | "2/3" | "16/9";
};

export default function ArtworkFrame({ artworkUrl, alt = "", aspectRatio = "1/1" }: Props) {
  return (
    <div
      style={{ aspectRatio, position: "relative", overflow: "hidden" }}
      className="w-full bg-card border border-border rounded-md"
    >
      {artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={artworkUrl}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-end p-4"
          style={{ background: "linear-gradient(135deg, oklch(0.32 0.08 290) 0%, oklch(0.20 0.05 280) 100%)" }}
        >
          <span className="text-xs uppercase tracking-widest text-white/40 select-none">
            Artwork
          </span>
        </div>
      )}
    </div>
  );
}
