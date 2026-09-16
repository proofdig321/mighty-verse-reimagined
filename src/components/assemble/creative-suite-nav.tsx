import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CreativeSuiteNavGroup, CreativeSuiteSectionId } from "@/lib/assemble/suite";

export function CreativeSuiteNav({
  groups,
  current,
  library,
}: {
  groups: CreativeSuiteNavGroup[];
  current?: CreativeSuiteSectionId;
  library?: { label: string; href: string }[];
}) {
  return (
    <nav aria-label="Studio" className="studio-rail">
      {groups.map((group) => (
        <div key={group.id} className="studio-rail-group">
          <p className="studio-rail-label">{group.label}</p>
          <ul>
            {group.items.map((item) => {
              const active = current === item.id;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("studio-rail-link", active && "studio-rail-link-current")}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {library?.length ? (
        <div className="studio-rail-group">
          <p className="studio-rail-label">Library</p>
          <ul>
            {library.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="studio-rail-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
