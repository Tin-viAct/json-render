import type { NextAppSpec } from "@json-render/next";
import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const specOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add"),
    path: z.string().min(1),
    value: z.unknown(),
  }),
  z.object({
    op: z.literal("replace"),
    path: z.string().min(1),
    value: z.unknown(),
  }),
  z.object({
    op: z.literal("remove"),
    path: z.string().min(1),
  }),
]);

const chatResponseSchema = z.object({
  message: z.string().min(1),
  operations: z.array(specOperationSchema).default([]),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type SpecOperation = z.infer<typeof specOperationSchema>;
export type ChatModelResponse = z.infer<typeof chatResponseSchema>;

/**
 * Validates and parses chat messages sent from the client.
 */
export function parseChatMessages(input: unknown): ChatMessage[] {
  return z.array(chatMessageSchema).parse(input);
}

/**
 * Validates and parses the structured model response contract.
 */
export function parseChatModelResponse(input: unknown): ChatModelResponse {
  return chatResponseSchema.parse(input);
}

/**
 * Performs a conservative runtime guard to avoid corrupting app state.
 */
export function assertLikelyNextAppSpec(input: unknown): NextAppSpec {
  if (!input || typeof input !== "object") {
    throw new Error("Spec must be an object.");
  }

  const candidate = input as Record<string, unknown>;
  if (!candidate.routes || typeof candidate.routes !== "object") {
    throw new Error("Spec must include routes.");
  }

  return input as NextAppSpec;
}

/**
 * Applies a list of JSON-pointer operations to a cloned spec.
 */
export function applyOperations(
  spec: NextAppSpec,
  operations: SpecOperation[],
): NextAppSpec {
  const next = structuredClone(spec) as unknown as Record<string, unknown>;

  for (const operation of operations) {
    const segments = decodePointer(operation.path);
    if (segments.length === 0) {
      throw new Error("Root-level operations are not supported.");
    }

    const target = resolveParent(next, segments);
    const key = segments[segments.length - 1];
    if (typeof key !== "string") {
      throw new Error(`Invalid pointer path: ${operation.path}`);
    }

    switch (operation.op) {
      case "add":
      case "replace":
        if (Array.isArray(target)) {
          const index = parseArrayIndex(
            key,
            target.length,
            operation.op === "add",
          );
          if (operation.op === "add") {
            target.splice(index, 0, operation.value);
          } else {
            target[index] = operation.value;
          }
        } else {
          target[key] = operation.value;
        }
        break;
      case "remove":
        if (Array.isArray(target)) {
          const index = parseArrayIndex(key, target.length, false);
          target.splice(index, 1);
        } else {
          delete target[key];
        }
        break;
    }
  }

  return assertLikelyNextAppSpec(next);
}

/**
 * Parses model text output and strips markdown code fences when present.
 */
export function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

function decodePointer(pointer: string): string[] {
  if (!pointer.startsWith("/")) {
    throw new Error(`Invalid pointer path: ${pointer}`);
  }

  return pointer
    .split("/")
    .slice(1)
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function resolveParent(
  root: Record<string, unknown>,
  segments: string[],
): Record<string, unknown> | unknown[] {
  let current: Record<string, unknown> | unknown[] = root;

  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(current)) {
      const index = parseArrayIndex(segment, current.length, false);
      const next = current[index];
      if (!next || typeof next !== "object") {
        throw new Error(`Cannot traverse array segment: ${segment}`);
      }
      current = next as Record<string, unknown> | unknown[];
      continue;
    }

    const next = current[segment];
    if (!next || typeof next !== "object") {
      throw new Error(`Cannot traverse object segment: ${segment}`);
    }
    current = next as Record<string, unknown> | unknown[];
  }

  return current;
}

function parseArrayIndex(
  raw: string,
  length: number,
  allowAppend: boolean,
): number {
  if (allowAppend && raw === "-") return length;
  const index = Number(raw);
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= length + (allowAppend ? 1 : 0)
  ) {
    throw new Error(`Invalid array index: ${raw}`);
  }
  return index;
}
