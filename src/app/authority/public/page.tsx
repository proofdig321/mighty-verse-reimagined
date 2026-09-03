import PageTopNav from "@/components/page-top-nav";
import { Button } from "@/components/ui/button";

const INFO_BLOCKS = [
  { icon: "📋", label: "Notices", sub: "Official notices and publications" },
  { icon: "🔏", label: "Proof of Publication", sub: "Verify authenticity and publication records" },
  { icon: "👥", label: "Participants", sub: "Contributors and creators" },
  { icon: "⬡", label: "Governance", sub: "Rules, policies and frameworks" },
];

export default function AuthorityPublicPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageTopNav activePath="/authority/public" />
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-10">

        <div className="space-y-2">
          <h1
            className="text-3xl font-semibold text-foreground"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            Authority
          </h1>
          <p className="text-sm text-muted-foreground">
            Governance, rights and proof of publication for the Mighty Verse.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {INFO_BLOCKS.map(({ icon, label, sub }) => (
            <div key={label} className="bg-card border border-border rounded-lg px-4 py-4 space-y-2">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" disabled>Learn More</Button>

      </div>
    </div>
  );
}
