export function isStudioCanvasPath(pathname: string): boolean {
  const normalized = pathname.split("?")[0].split("#")[0];

  if (normalized === "/studio" || normalized.startsWith("/studio/")) {
    return true;
  }

  return /^\/authority\/universes\/[^/]+(?:\/.*)?$/.test(normalized);
}
