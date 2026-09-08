"use client";

import { useRouter } from "next/navigation";
import UniverseIdentityForm from "@/components/assemble/universe-identity-form";
import { api } from "../../../_shared/authority-utils";
import type { UniverseIdentity } from "@/lib/assemble/identity";
import { creativeSuiteHref } from "@/lib/assemble/studio";

export default function IdentityCurationClient({
  masterId,
  title,
  description,
  fromCurate = false,
}: {
  masterId: string;
  title: string;
  description: string;
  fromCurate?: boolean;
}) {
  const router = useRouter();
  const workspaceHref = creativeSuiteHref(masterId, fromCurate ? "curate" : null);
  const savedHref = fromCurate
    ? `${workspaceHref}&identity=saved`
    : `${workspaceHref}?identity=saved`;

  async function handleSave(identity: UniverseIdentity) {
    const res = await api("/api/authority/presentation", {
      master_id: masterId,
      title: identity.title,
      description: identity.description,
    });
    if (res.error) return { error: res.error };
    router.push(savedHref);
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
