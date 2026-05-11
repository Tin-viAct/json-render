#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { z } from "zod";

/**
 * Parse a .spec.jsonl stream into state patches and a final root element.
 */
function parseJsonlSpec(raw) {
  const lines = raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("Spec file is empty.");
  }

  const parsed = lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON at line ${index + 1}.`);
    }
  });

  const rootElement = parsed[parsed.length - 1];
  const patches = parsed.slice(0, -1);
  return { rootElement, patches };
}

function toFlatSpec(rootElement, patches) {
  const elements = {};
  let id = 0;

  const visit = (node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      throw new Error("Root element tree is not a valid object.");
    }
    const key = `e${++id}`;
    const children = Array.isArray(node.children) ? node.children : [];
    const childKeys = children.map((child) => visit(child));
    const flat = { ...node };
    delete flat.children;
    if (childKeys.length > 0) {
      flat.children = childKeys;
    }
    elements[key] = flat;
    return key;
  };

  const root = visit(rootElement);
  const state = {};
  for (const patch of patches) {
    if (
      patch &&
      patch.op === "add" &&
      typeof patch.path === "string" &&
      patch.path.startsWith("/state")
    ) {
      // State materialization is not required for structural checks.
      state.__hasPatches = true;
    }
  }
  return { root, elements, state };
}

const ElementSchema = z
  .object({
    type: z.string(),
    props: z.record(z.string(), z.unknown()).optional(),
    children: z.array(z.unknown()).optional(),
    visible: z.unknown().optional(),
    on: z.unknown().optional(),
    repeat: z.unknown().optional(),
    watch: z.unknown().optional(),
  })
  .passthrough();

function fallbackValidateSpec(flatSpec, patches) {
  if (!flatSpec.root || !flatSpec.elements[flatSpec.root]) {
    return { valid: false, issues: [{ message: "Missing or invalid root." }] };
  }
  if (Object.keys(flatSpec.elements).length === 0) {
    return { valid: false, issues: [{ message: "Spec has no elements." }] };
  }

  const issues = [];
  for (const [key, element] of Object.entries(flatSpec.elements)) {
    const parsed = ElementSchema.safeParse(element);
    if (!parsed.success) {
      issues.push({ message: `Element "${key}" failed schema validation.` });
      continue;
    }
    const props = element.props;
    if (props && typeof props === "object") {
      for (const misplaced of ["visible", "on", "repeat", "watch"]) {
        if (props[misplaced] !== undefined) {
          issues.push({
            message: `Element "${key}" has "${misplaced}" inside props.`,
          });
        }
      }
    }
    if (Array.isArray(element.children)) {
      for (const childKey of element.children) {
        if (!flatSpec.elements[childKey]) {
          issues.push({
            message: `Element "${key}" references missing child "${childKey}".`,
          });
        }
      }
    }
  }

  if (patches.some((p) => p?.path?.startsWith?.("/state"))) {
    const invalidPatch = patches.find(
      (p) => p.op !== "add" || typeof p.path !== "string" || !p.path.startsWith("/state"),
    );
    if (invalidPatch) {
      issues.push({ message: "State patches must be add ops under /state." });
    }
  }

  return { valid: issues.length === 0, issues };
}

async function resolveCoreValidator() {
  try {
    const mod = await import("@json-render/core");
    if (typeof mod.validateSpec === "function") {
      return mod.validateSpec;
    }
  } catch {
    // Fall through to workspace resolution.
  }

  const workspaceRoot = await findWorkspaceRoot();
  if (!workspaceRoot) {
    return null;
  }

  const coreDistPath = path.join(workspaceRoot, "packages/core/dist/index.mjs");
  if (!(await pathExists(coreDistPath))) {
    const built = await buildWorkspaceCore(workspaceRoot);
    if (!built || !(await pathExists(coreDistPath))) {
      return null;
    }
  }

  try {
    const mod = await import(pathToFileURL(coreDistPath).href);
    if (typeof mod.validateSpec === "function") {
      return mod.validateSpec;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Find the monorepo root by traversing upward from this script.
 */
async function findWorkspaceRoot() {
  let dir = path.dirname(new URL(import.meta.url).pathname);
  while (true) {
    const packageJsonPath = path.join(dir, "package.json");
    if (await pathExists(packageJsonPath)) {
      try {
        const raw = await fs.readFile(packageJsonPath, "utf8");
        const json = JSON.parse(raw);
        if (
          Array.isArray(json.workspaces) &&
          (await pathExists(path.join(dir, "packages/core/package.json")))
        ) {
          return dir;
        }
      } catch {
        // Ignore malformed package.json and keep walking up.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Build @json-render/core in the workspace so dist exports are available.
 */
function buildWorkspaceCore(workspaceRoot) {
  return new Promise((resolve) => {
    const child = spawn(
      "pnpm",
      ["--dir", workspaceRoot, "--filter", "@json-render/core", "build"],
      { stdio: "ignore" },
    );
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

/**
 * Check whether a path exists.
 */
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error("Usage: node validate-spec.mjs <path-to-spec.jsonl>");
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), specPath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const { rootElement, patches } = parseJsonlSpec(raw);
  const flatSpec = toFlatSpec(rootElement, patches);

  const coreValidateSpec = await resolveCoreValidator();
  const result = coreValidateSpec
    ? coreValidateSpec(flatSpec, { checkOrphans: false })
    : fallbackValidateSpec(flatSpec, patches);

  if (!result.valid) {
    const issue = result.issues?.[0];
    const message = issue?.message ?? "Validation failed.";
    const mode = coreValidateSpec ? "core" : "fallback";
    console.error(`[${mode}] ${message}`);
    process.exit(1);
  }

  const mode = coreValidateSpec ? "core" : "fallback";
  console.log(`[${mode}] Valid spec: ${specPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
