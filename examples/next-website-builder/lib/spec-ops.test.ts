import { describe, expect, it } from "vitest";
import { defaultSpec } from "./default-spec";
import { applyOperations, assertLikelyNextAppSpec } from "./spec-ops";

describe("spec operations", () => {
  it("applies a replace operation on nested props", () => {
    const updated = applyOperations(defaultSpec, [
      {
        op: "replace",
        path: "/routes/~1/page/elements/hero/props/headline",
        value: "Ship faster with Viact",
      },
    ]);

    expect(updated.routes["/"]?.page.elements.hero?.props).toMatchObject({
      headline: "Ship faster with Viact",
    });
  });

  it("rejects invalid specs", () => {
    expect(() => assertLikelyNextAppSpec({})).toThrowError(/routes/);
  });
});
