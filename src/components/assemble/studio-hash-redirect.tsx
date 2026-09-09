"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { resolveStudioHash, suiteChildHref } from "@/lib/assemble/suite";

/**
 * Maps legacy Studio hash fragments onto child workspace routes.
 * Scene hashes open `/scenes/[sceneId]`. Moment hashes stay on Scenes.
 */
export function StudioHashRedirect({ suiteHref }: { suiteHref: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const resolved = resolveStudioHash(hash);
    if (!resolved) return;

    const targetPath = suiteChildHref(suiteHref.split("?")[0], resolved.path);
    const params = new URLSearchParams(searchParams.toString());
    if (resolved.search) {
      for (const [key, value] of Object.entries(resolved.search)) params.set(key, value);
    }
    const qs = params.toString();
    const nextHash = resolved.retainHash ? `#${resolved.retainHash}` : "";
    const searchMatches =
      !resolved.search || Object.entries(resolved.search).every(([key, value]) => params.get(key) === value);

    if (pathname === targetPath && searchMatches) {
      if (resolved.retainHash) return;
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
      return;
    }

    router.replace(`${targetPath}${qs ? `?${qs}` : ""}${nextHash}`);
  }, [pathname, router, searchParams, suiteHref]);

  return null;
}
