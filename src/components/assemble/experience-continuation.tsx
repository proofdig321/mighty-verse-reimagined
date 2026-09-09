import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ExperienceContinuation({
  href,
  holographicHref,
  universeTitle,
}: {
  href: string;
  holographicHref?: string | null;
  universeTitle: string;
}) {
  return (
    <section className="suite-continuation" aria-labelledby="universe-experience-continuation">
      <p className="suite-kicker">Continuation</p>
      <h2 id="universe-experience-continuation" className="suite-section-title">
        Experience
      </h2>
      <p className="suite-section-note">
        The Universe is composed in Studio. Enter its public Experience. This is navigation, not a publish or realize action.
        Public 2.5D remains an audience surface. Studio Preview stays here.
      </p>
      <ol className="suite-continuation-flow">
        <li>Assemble</li>
        <li className="suite-continuation-arrow" aria-hidden="true">
          ↓
        </li>
        <li>Experience</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Link href={href} className={cn(buttonVariants({ size: "lg" }), "suite-continuation-cta")}>
          Enter Experience
          <span className="sr-only">{` for ${universeTitle}`}</span>
        </Link>
        {holographicHref ? (
          <Link href={holographicHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Open public 2.5D
          </Link>
        ) : null}
      </div>
    </section>
  );
}
