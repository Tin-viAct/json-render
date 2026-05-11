import type { NextAppSpec } from "@json-render/next";
import { defaultSpec } from "./default-spec";
import {
  applyOperations,
  assertLikelyNextAppSpec,
  type SpecOperation,
} from "./spec-ops";

let currentSpec: NextAppSpec = defaultSpec;
const specHistory: NextAppSpec[] = [];
const MAX_HISTORY = 20;

/**
 * Returns the current in-memory app spec.
 */
export function getSpec(): NextAppSpec {
  return currentSpec;
}

/**
 * Returns a copy of in-memory spec history snapshots.
 */
export function getSpecHistory(): NextAppSpec[] {
  return [...specHistory];
}

/**
 * Sets the current spec after runtime guards and snapshots previous state.
 */
export function setSpec(spec: NextAppSpec): void {
  const validated = assertLikelyNextAppSpec(spec);
  specHistory.push(structuredClone(currentSpec));
  if (specHistory.length > MAX_HISTORY) {
    specHistory.shift();
  }
  currentSpec = validated;
}

/**
 * Applies operation-based updates and persists only when valid.
 */
export function setSpecWithOperations(
  operations: SpecOperation[],
): NextAppSpec {
  const updated = applyOperations(currentSpec, operations);
  setSpec(updated);
  return currentSpec;
}

/**
 * Restores the latest valid snapshot if available.
 */
export function rollbackSpec(): NextAppSpec {
  const previous = specHistory.pop();
  if (previous) {
    currentSpec = previous;
  }
  return currentSpec;
}
