import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const exampleRoot = resolve(__dirname, "..");
const repoRoot = resolve(exampleRoot, "..", "..");

const requiredPackages = [
  { name: "@json-render/core", entry: "node_modules/@json-render/core/dist/index.mjs" },
  { name: "@internal/react-state", entry: "node_modules/@internal/react-state/dist/index.mjs" },
  { name: "@json-render/react", entry: "node_modules/@json-render/react/dist/index.mjs" },
  { name: "@json-render/shadcn", entry: "node_modules/@json-render/shadcn/dist/index.mjs" },
  { name: "@json-render/next", entry: "node_modules/@json-render/next/dist/index.mjs" },
];

/**
 * Ensures workspace package dist files exist before starting Next.js.
 */
function ensureWorkspaceBuilds() {
  const missing = requiredPackages.filter((pkg) => {
    return !existsSync(resolve(exampleRoot, pkg.entry));
  });

  if (missing.length === 0) {
    return;
  }

  for (const pkg of missing) {
    const result = spawnSync(
      "pnpm",
      ["--dir", repoRoot, "--filter", pkg.name, "build"],
      {
        stdio: "inherit",
        env: process.env,
      },
    );

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

ensureWorkspaceBuilds();
