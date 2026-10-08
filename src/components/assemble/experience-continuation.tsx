import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ExperienceContinuation({
  href,
  universeHref,
  universeTitle,
}: {
  href: string;
  universeHref?: string | null;
  universeTitle: string;
}) {
  return (
    <section className="suite-continuation" aria-labelledby="universe-experience-continuation">
      <div className="studio-composer">
        <p className="suite-kicker">Public Experience</p>
        <h2 id="universe-experience-continuation" className="text-base font-medium text-foreground">
          Holographic Experience
        </h2>
        <p className="text-sm text-muted-foreground">
          Studio composes the work. Holographic Experience is what the audience sees. It is not a Studio editor.
        </p>
        <div className="border-t border-border pt-3 flex flex-wrap items-center gap-3">
          <ol className="suite-continuation-flow mb-0">
            <li>Assemble</li>
            <li className="suite-continuation-arrow" aria-hidden="true">→</li>
            <li>Holographic Experience</li>
          </ol>
          <Link
            href={href}
            className={cn(buttonVariants({ size: "lg" }), "suite-continuation-cta")}
            data-experience-entry="holographic"
          >
            Holographic Experience
            <span className="sr-only">{` for ${universeTitle}`}</span>
          </Link>
          {universeHref ? (
            <Link href={universeHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Open Universe
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
