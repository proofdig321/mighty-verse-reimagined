import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="bg-card/80">
        <CardHeader>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Public Experience</p>
          <CardTitle>
            <h2 id="universe-experience-continuation" className="text-base font-medium">
              Holographic Experience
            </h2>
          </CardTitle>
          <CardDescription>
            Studio composes the work. Holographic Experience is what the audience sees. It is not a Studio editor.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap items-center gap-3">
          <ol className="suite-continuation-flow mb-0">
            <li>Assemble</li>
            <li className="suite-continuation-arrow" aria-hidden="true">
              →
            </li>
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
        </CardFooter>
      </Card>
    </section>
  );
}
