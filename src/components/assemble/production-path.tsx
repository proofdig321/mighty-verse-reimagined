import Link from "next/link";
import type { ProductionPathStep } from "@/lib/assemble/workflow";
import { productionStepStatusLabel } from "@/lib/assemble/workflow";

export function ProductionPath({ steps }: { steps: ProductionPathStep[] }) {
  return (
    <nav aria-label="Creative production path" className="suite-production-path">
      <p className="suite-kicker">Production path</p>
      <p className="suite-section-note">
        Follow source media through Sentinel, storyboard, authorisation, and 2.5D preview.
        This is navigation, not a wizard. Jump to any stage.
      </p>
      <ol className="suite-production-steps">
        {steps.map((step, index) => (
          <li key={step.id} data-step-id={step.id} data-step-status={step.status}>
            {index > 0 ? (
              <span className="suite-production-arrow" aria-hidden="true">
                →
              </span>
            ) : null}
            <Link href={step.href} className={`suite-production-step suite-production-step-${step.status}`}>
              <span className="suite-production-label">{step.label}</span>
              <span className="suite-production-status">{productionStepStatusLabel(step.status)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
