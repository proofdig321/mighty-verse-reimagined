import type { ReactNode } from "react";

export function StudioEmptyState({
  kicker,
  title,
  body,
  action,
}: {
  kicker?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="studio-empty">
      {kicker ? <p className="suite-kicker">{kicker}</p> : null}
      <p className="studio-empty-title">{title}</p>
      {body ? <p className="studio-empty-body">{body}</p> : null}
      {action}
    </div>
  );
}
