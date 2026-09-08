import Link from "next/link";

export type HierarchyBreadcrumbItem = {
  label: string;
  href?: string;
};

export function HierarchyBreadcrumb({ items }: { items: HierarchyBreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="contents">
          {index > 0 && <span className="opacity-30">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
