import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ExperienceContinuation({
  href,
  universeTitle,
}: {
  href: string;
  universeTitle: string;
}) {
  return (
    <section className="suite-continuation" aria-labelledby="universe-experience-continuation">
      <p className="suite-kicker">Continuation</p>
      <h2 id="universe-experience-continuation" className="suite-section-title">
        Experience
      </h2>
      <p className="suite-section-note">
        The Universe is composed. Enter its public Experience. This is navigation, not a publish or realize action.
      </p>
      <ol className="suite-continuation-flow">
        <li>Assemble</li>
        <li className="suite-continuation-arrow" aria-hidden="true">
          ↓
        </li>
        <li>Experience</li>
      </ol>
      <Link href={href} className={cn(buttonVariants({ size: "lg" }), "suite-continuation-cta")}>
        Enter Experience
        <span className="sr-only">{` for ${universeTitle}`}</span>
      </Link>
    </section>
  );
}
