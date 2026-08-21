"use client";

export default function ExperienceToggle() {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">Experience</span>
      <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
        <span
          className="px-3 py-1 rounded-full text-xs font-medium"
          style={{ background: "var(--accent-mv)", color: "#000" }}
        >
          2D
        </span>
        <span
          className="px-3 py-1 rounded-full text-xs font-medium text-muted-foreground cursor-not-allowed select-none"
          title="2.5D experience — coming soon"
        >
          2.5D
        </span>
      </div>
    </div>
  );
}
