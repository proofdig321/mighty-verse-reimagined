/**
 * Minimal ESM loader for Node 24 that resolves extensionless TypeScript imports.
 * Usage: node --import ./ts-loader.mjs --experimental-strip-types test.mjs
 *
 * Handles the pattern used throughout this codebase: `import { x } from "./foo"`
 * where foo.ts exists but no foo.js does.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as resolvePath, dirname } from "node:path";

export async function resolve(specifier, context, nextResolve) {
  // Only handle relative imports without extensions
  if (specifier.startsWith(".") && !specifier.match(/\.\w+$/)) {
    const parentDir = context.parentURL
      ? dirname(fileURLToPath(context.parentURL))
      : process.cwd();
    const candidate = resolvePath(parentDir, specifier + ".ts");
    if (existsSync(candidate)) {
      return { shortCircuit: true, url: pathToFileURL(candidate).href };
    }
  }
  return nextResolve(specifier, context);
}
