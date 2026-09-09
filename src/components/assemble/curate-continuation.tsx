import Link from "next/link";
import { curateContinuation } from "@/lib/assemble/curate-continuation";

export function CurateContinuationLinks({
  universeId,
  assetId,
  associated,
  muralRegistered,
  mediaAttached,
}: {
  universeId: string | null;
  assetId?: string | null;
  associated?: boolean;
  muralRegistered?: boolean;
  mediaAttached?: boolean;
}) {
  const next = curateContinuation({
    universeId,
    assetId,
    associated,
    muralRegistered,
    mediaAttached,
  });

  return (
    <div className="space-y-2" role="status">
      <p className="text-xs text-foreground">{next.copy}</p>
      {next.actions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {next.actions.map((action) => (
            <Link
              key={`${action.label}-${action.href}`}
              href={action.href}
              className="text-xs text-foreground hover:underline"
            >
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
