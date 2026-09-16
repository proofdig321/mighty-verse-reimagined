export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { occupancyLabel } from "@/lib/assemble/occupancy";
import { curateHubHref } from "@/lib/assemble/studio";
import { loadUniverseCatalogue } from "@/lib/assemble/load-universe-catalogue";
import { WithdrawWork } from "@/components/assemble/withdraw-work";
import { PaginatedItems } from "@/components/assemble/collection-pager";
import { cn } from "@/lib/utils";

export default async function UniversesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/authority/universes");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in?next=/authority/universes");

  const universes = await loadUniverseCatalogue();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Creative Studio</p>
        <h1 className="text-3xl font-semibold tracking-tight">Universes</h1>
        <p className="text-sm text-muted-foreground">
          Curated work opens Creative Studio. In-progress work stays on Curate Hub. Edit identity or withdraw orphan shells here so they do not accumulate. Withdraw removes a work from Discover — records stay. Super Hero Ego cannot be withdrawn.
          {universes.length > 0 && <span className="ml-2 text-muted-foreground/60">{universes.length} universe{universes.length !== 1 ? "s" : ""}</span>}
        </p>
      </div>

      {universes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No universes registered yet.</p>
      ) : (
        <PaginatedItems items={universes} label="Universes">
          {(page) => (
            <div className="overflow-hidden rounded-xl border border-border bg-card/60">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/20">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Universe</th>
                    <th className="hidden px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:table-cell">Occupancy</th>
                    <th className="hidden px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">Murals</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {page.map((u) => {
                    const openHref = u.occupancy === "curated" ? `/authority/universes/${u.master_id}` : curateHubHref(u.master_id);
                    const openLabel = u.occupancy === "curated" ? "Open Creative Studio" : "Open Curate Hub";
                    return (
                      <tr key={u.master_id} className="transition-colors hover:bg-muted/20" data-occupancy={u.occupancy}>
                        <td className="px-4 py-3">
                          <Link href={openHref} className="font-medium text-foreground hover:underline">
                            {u.title ?? <span className="italic text-muted-foreground">Untitled universe</span>}
                          </Link>
                          {u.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{u.description}</p>}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Badge variant={u.occupancy === "orphan" ? "destructive" : "outline"}>{occupancyLabel(u.occupancy)}</Badge>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <Badge variant="outline">{u.muralCount}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Link
                              href={`/authority/universes/${u.master_id}/identity`}
                              className={cn(buttonVariants({ size: "sm" }))}
                            >
                              Edit
                            </Link>
                            <Link href={openHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                              {openLabel}
                            </Link>
                            {u.withdrawable ? (
                              <WithdrawWork masterId={u.master_id} title={u.title} occupancy={u.occupancy} />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PaginatedItems>
      )}
    </div>
  );
}
