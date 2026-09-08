"use client";

import { useRouter } from "next/navigation";
import UniverseIdentityForm from "@/components/assemble/universe-identity-form";
import { api } from "../../../_shared/authority-utils";
import type { UniverseIdentity } from "@/lib/assemble/identity";

export default function IdentityCurationClient({
  masterId,
  title,
  description,
}: {
  masterId: string;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const workspaceHref = `/authority/universes/${masterId}`;

  async function handleSave(identity: UniverseIdentity) {
    const res = await api("/api/authority/presentation", {
      master_id: masterId,
      title: identity.title,
      description: identity.description,
    });
    if (res.error) return { error: res.error };
    router.push(`${workspaceHref}?identity=saved`);
    router.refresh();
  }

  return (
    <UniverseIdentityForm
      initialTitle={title}
      initialDescription={description}
      onSave={handleSave}
      onCancel={() => router.push(workspaceHref)}
    />
  );
}
