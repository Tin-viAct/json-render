import { tool, type ToolSet } from "ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";
import { loadMcpConfig, type McpServerConfig } from "./config";

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

type ServerSession = {
  client: Client;
  transport: Transport;
  tools: McpTool[];
};

/**
 * MCP bridge that loads configured servers and exposes their tools to AI SDK.
 */
export class McpToolBridge {
  private sessions = new Map<string, ServerSession>();

  /**
   * Connects configured MCP stdio servers and caches discovered tools.
   */
  async initialize(): Promise<void> {
    const config = loadMcpConfig();
    const entries = Object.entries(config.mcpServers);

    for (const [serverName, serverConfig] of entries) {
      await this.connectServer(serverName, serverConfig);
    }
  }

  /**
   * Returns namespaced tool wrappers consumable by ToolLoopAgent.
   */
  toToolSet(): ToolSet {
    const tools: ToolSet = {};

    for (const [serverName, session] of this.sessions.entries()) {
      for (const remoteTool of session.tools) {
        const localName = this.toLocalToolName(serverName, remoteTool.name);
        const inputDescription =
          remoteTool.inputSchema != null
            ? `Input JSON schema: ${JSON.stringify(remoteTool.inputSchema)}`
            : "Input schema is not provided by server.";

        tools[localName] = tool({
          description: `[MCP ${serverName}] ${remoteTool.description ?? remoteTool.name}. ${inputDescription}`,
          inputSchema: z.object({
            arguments: z.record(z.string(), z.unknown()).default({}),
          }),
          execute: async ({ arguments: args }) => {
            try {
              const normalizedArgs =
                serverName === "viact_dev"
                  ? (toAsciiSafeValue(args) as Record<string, unknown>)
                  : args;
              const safeArgs =
                serverName === "viact_dev" ? normalizedArgs : normalizedArgs;
              const response = await session.client.callTool({
                name: remoteTool.name,
                arguments: safeArgs,
              });
              const extractedError = extractEmbeddedMcpError(response);
              if (extractedError) {
                return {
                  server: serverName,
                  tool: remoteTool.name,
                  error: extractedError,
                };
              }
              return {
                server: serverName,
                tool: remoteTool.name,
                result: response,
              };
            } catch (error) {
              return {
                server: serverName,
                tool: remoteTool.name,
                error:
                  error instanceof Error
                    ? error.message
                    : "Unknown MCP tool error.",
              };
            }
          },
        });
      }
    }

    return tools;
  }

  /**
   * Closes all open MCP transports and clients.
   */
  async close(): Promise<void> {
    for (const session of this.sessions.values()) {
      try {
        await session.client.close();
      } catch {
        // Ignore close failures during teardown.
      }
      try {
        await session.transport.close();
      } catch {
        // Ignore transport close failures during teardown.
      }
    }
    this.sessions.clear();
  }

  private async connectServer(
    serverName: string,
    serverConfig: McpServerConfig,
  ): Promise<void> {
    const transport = this.createTransport(serverConfig);

    const client = new Client({
      name: "json-render-chat-mcp-bridge",
      version: "1.0.0",
    });

    try {
      await client.connect(transport);
      const listed = await client.listTools();
      const tools = listed.tools ?? [];
      this.sessions.set(serverName, { client, transport, tools });
    } catch {
      try {
        await client.close();
      } catch {}
      try {
        await transport.close();
      } catch {}
    }
  }

  private createTransport(serverConfig: McpServerConfig): Transport {
    if (serverConfig.transport === "stdio") {
      return new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args ?? [],
        env: serverConfig.env,
      });
    }

    if (serverConfig.transport === "sse") {
      const headers = {
        ...(serverConfig.headers ?? {}),
        "Accept-Charset": "utf-8",
      };
      return new SSEClientTransport(new URL(serverConfig.url), {
        eventSourceInit: serverConfig.headers
          ? { fetch: (input, init) => fetch(input, { ...init, headers }) }
          : undefined,
        requestInit: { headers },
      });
    }

    const headers = {
      ...(serverConfig.headers ?? {}),
      "Content-Type": "application/json; charset=utf-8",
      "Accept-Charset": "utf-8",
    };

    return new StreamableHTTPClientTransport(new URL(serverConfig.url), {
      requestInit: { headers },
    });
  }

  private toLocalToolName(serverName: string, toolName: string): string {
    const safe = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, "_");
    return `mcp_${safe(serverName)}_${safe(toolName)}`;
  }
}

/**
 * Converts strings to ASCII-safe values to avoid downstream encoding crashes.
 */
function toAsciiSafeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "")
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => toAsciiSafeValue(item));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      output[key] = toAsciiSafeValue(child);
    }
    return output;
  }
  return value;
}

/**
 * Some MCP servers return textual errors inside content while isError=false.
 * Promote those to real tool errors so the agent does not treat them as success.
 */
function extractEmbeddedMcpError(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const value = response as {
    content?: Array<{ type?: string; text?: string }>;
    isError?: boolean;
  };
  if (value.isError) return "MCP tool returned isError=true.";
  const textErrors = (value.content ?? [])
    .filter((item) => item?.type === "text" && typeof item?.text === "string")
    .map((item) => item.text as string)
    .filter((text) => text.startsWith("[ERROR]"));
  if (textErrors.length === 0) return null;
  return textErrors.join("\n");
}
