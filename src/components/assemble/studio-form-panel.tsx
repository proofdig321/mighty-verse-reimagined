import type { ReactNode } from "react";

/**
 * StudioFormPanel — canonical form container for authority workspace surfaces.
 * Replaces Card/CardContent. Uses studio-composer vocabulary.
 */
export function StudioFormPanel({
  title,
  description,
  onCancel,
  children,
}: {
  title: string;
  description?: string;
  onCancel?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="studio-composer">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          ) : null}
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            Cancel
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
