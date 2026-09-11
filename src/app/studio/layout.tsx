import type { ReactNode } from "react";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import { StudioShell } from "@/components/assemble/studio-shell";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  await requireStudioUser("/studio");
  return <StudioShell>{children}</StudioShell>;
}
