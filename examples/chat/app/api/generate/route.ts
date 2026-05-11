import { createAgent } from "@/lib/agent";
import { McpToolBridge } from "@/lib/mcp/bridge";
import { minuteRateLimit, dailyRateLimit } from "@/lib/rate-limit";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { pipeJsonRender } from "@json-render/core";
import { headers } from "next/headers";

export const maxDuration = 60;
let sharedMcpBridge: McpToolBridge | null = null;

async function getSharedMcpBridge(): Promise<McpToolBridge> {
  if (!sharedMcpBridge) {
    sharedMcpBridge = new McpToolBridge();
    await sharedMcpBridge.initialize();
  }
  return sharedMcpBridge;
}

export async function POST(req: Request) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";

  const [minuteResult, dailyResult] = await Promise.all([
    minuteRateLimit.limit(ip),
    dailyRateLimit.limit(ip),
  ]);

  if (!minuteResult.success || !dailyResult.success) {
    const isMinuteLimit = !minuteResult.success;
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        message: isMinuteLimit
          ? "Too many requests. Please wait a moment before trying again."
          : "Daily limit reached. Please try again tomorrow.",
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const body = await req.json();
  const uiMessages: UIMessage[] = body.messages;

  if (!uiMessages || !Array.isArray(uiMessages) || uiMessages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages array is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const mcpBridge = await getSharedMcpBridge();
    const modelMessages = await convertToModelMessages(uiMessages);
    const agent = createAgent(mcpBridge.toToolSet());
    const result = await agent.stream({ messages: modelMessages });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.merge(pipeJsonRender(result.toUIMessageStream()));
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    if (sharedMcpBridge) {
      await sharedMcpBridge.close().catch(() => {});
      sharedMcpBridge = null;
    }
    return new Response(
      JSON.stringify({
        error: "MCP initialization failed",
        message: error instanceof Error ? error.message : "Unknown MCP error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
