import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CreativeSuiteNavItem, CreativeSuiteSectionId } from "@/lib/assemble/suite";

export function CreativeSuiteNav({
  items,
  current,
}: {
  items: CreativeSuiteNavItem[];
  current?: CreativeSuiteSectionId;
}) {
  return (
    <nav aria-label="Creative Suite" className="flex flex-wrap gap-1 border-b border-border">
      {items.map((item) => {
        const active = current === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-3 py-2 text-sm transition-colors",
              active
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
