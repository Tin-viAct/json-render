import type { NextAppSpec } from "@json-render/next";
import { getSpec, setSpec } from "@/lib/spec-store";
import { assertLikelyNextAppSpec } from "@/lib/spec-ops";

export async function GET() {
  return Response.json(getSpec());
}

export async function PUT(req: Request) {
  try {
    const input = (await req.json()) as NextAppSpec;
    setSpec(assertLikelyNextAppSpec(input));
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid spec payload.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
