import type { NextAppSpec } from "@json-render/next";
import { z } from "zod";
import {
  applyOperations,
  assertLikelyNextAppSpec,
  parseChatMessages,
  parseModelJson,
} from "@/lib/spec-ops";
import { getSpec, setSpec } from "@/lib/spec-store";

const DEFAULT_MODEL = "gemini-2.5-flash";

const modelResponseSchema = z.object({
  message: z.string().min(1),
  operations: z
    .array(
      z.discriminatedUnion("op", [
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
      ]),
    )
    .default([]),
});

const EDIT_CONTRACT = `You are an agentic UI builder for a Next.js site spec.
Return JSON only, with this exact shape:
{
  "message": "short explanation for user and what data you used",
  "operations": [
    { "op": "add|replace|remove", "path": "/json/pointer", "value": "required for add/replace" }
  ]
}

Rules:
- Do not return markdown.
- Build dashboards/websites from available data context when the user asks.
- You may create new routes, sections, state objects, and components via operations.
- Prefer deterministic operations that preserve existing valid structure.
- Keep "layouts", "routes", and route.page trees valid.
- When asked about stock/market data, produce a dashboard UI (metrics + trend + table style layout).
- If request is unclear, keep operations empty and ask in "message".`;

/**
 * Returns true when a prompt is likely asking for stock market dashboard data.
 */
function isStockQuery(text: string): boolean {
  const query = text.toLowerCase();
  return (
    query.includes("stock") ||
    query.includes("price") ||
    query.includes("market") ||
    query.includes("vnindex") ||
    query.includes("vni")
  );
}

/**
 * Fetches VNINDEX close prices for the last ~30 days from Yahoo Finance.
 */
async function fetchVNIndex30Days() {
  const endpoint =
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EVNINDEX?range=1mo&interval=1d";
  const response = await fetch(endpoint, {
    headers: {
      "User-Agent": "json-render-poc/1.0",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch VNINDEX data: ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            close?: Array<number | null>;
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }>;
    };
  };

  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const close = quote?.close ?? [];
  const open = quote?.open ?? [];
  const high = quote?.high ?? [];
  const low = quote?.low ?? [];
  const volume = quote?.volume ?? [];

  const points = timestamps
    .map((timestamp, index) => {
      const closeValue = close[index];
      if (typeof closeValue !== "number") return null;
      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        close: Number(closeValue.toFixed(2)),
        open:
          typeof open[index] === "number"
            ? Number((open[index] as number).toFixed(2))
            : null,
        high:
          typeof high[index] === "number"
            ? Number((high[index] as number).toFixed(2))
            : null,
        low:
          typeof low[index] === "number"
            ? Number((low[index] as number).toFixed(2))
            : null,
        volume:
          typeof volume[index] === "number"
            ? Math.trunc(volume[index] as number)
            : null,
      };
    })
    .filter((point): point is NonNullable<typeof point> => point !== null);

  const latest = points[points.length - 1];
  const first = points[0];
  const change =
    latest && first ? Number((latest.close - first.close).toFixed(2)) : null;
  const changePercent =
    latest && first && first.close !== 0
      ? Number((((latest.close - first.close) / first.close) * 100).toFixed(2))
      : null;

  return {
    symbol: "VNINDEX",
    period: "30d",
    points,
    summary: {
      latestClose: latest?.close ?? null,
      firstClose: first?.close ?? null,
      change,
      changePercent,
      high30d: points.length
        ? Math.max(...points.map((point) => point.close))
        : null,
      low30d: points.length
        ? Math.min(...points.map((point) => point.close))
        : null,
    },
  };
}

/**
 * Produces patch-like spec operations from chat history using Gemini.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      messages: unknown;
      spec?: unknown;
    };
    const messages = parseChatMessages(body.messages);
    const baseSpec = assertLikelyNextAppSpec(body.spec ?? getSpec());

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
      return Response.json(
        { ok: false, error: "Missing GOOGLE_GENERATIVE_AI_API_KEY." },
        { status: 500 },
      );
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const latestRequest = messages[messages.length - 1]?.content ?? "";
    const dataContext: Record<string, unknown> = {};

    if (isStockQuery(latestRequest)) {
      dataContext.vnindex30d = await fetchVNIndex30Days();
    }

    const promptPayload = {
      contract: EDIT_CONTRACT,
      currentSpec: baseSpec,
      messages,
      request: latestRequest,
      dataContext,
      instructions:
        "Use provided dataContext as source-of-truth and build/modify UI accordingly.",
    };

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: EDIT_CONTRACT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: JSON.stringify(promptPayload) }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const details = await geminiResponse.text();
      throw new Error(`Gemini request failed: ${details}`);
    }

    const raw = (await geminiResponse.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = raw.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Gemini returned empty content.");
    }

    const parsed = modelResponseSchema.parse(parseModelJson(rawText));
    const updatedSpec = applyOperations(baseSpec, parsed.operations);
    setSpec(updatedSpec as NextAppSpec);

    return Response.json({
      ok: true,
      message: parsed.message,
      operations: parsed.operations,
      spec: updatedSpec,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chat update failed.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
