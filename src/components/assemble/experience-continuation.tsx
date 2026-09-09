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
      <p className="suite-kicker">Continuation</p>
      <h2 id="universe-experience-continuation" className="suite-section-title">
        Experience
      </h2>
      <p className="suite-section-note">
        Studio composes the work. Experience presents it. This is navigation, not a publish or realize action.
        2.5D is the presentation of Mural, Scenes, Creative Moments, and approved production layers.
      </p>
      <ol className="suite-continuation-flow">
        <li>Assemble</li>
        <li className="suite-continuation-arrow" aria-hidden="true">
          ↓
        </li>
        <li>Experience</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Link
          href={href}
          className={cn(buttonVariants({ size: "lg" }), "suite-continuation-cta")}
          data-experience-entry="experience"
        >
          Enter Experience
          <span className="sr-only">{` for ${universeTitle}`}</span>
        </Link>
        {universeHref ? (
          <Link href={universeHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Open Universe
          </Link>
        ) : null}
      </div>
    </section>
  );
}
