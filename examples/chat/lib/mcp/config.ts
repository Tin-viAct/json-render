import fs from "node:fs";
import { z } from "zod";

const stdioServerSchema = z.object({
  transport: z.literal("stdio").default("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
});

const streamableHttpServerSchema = z.object({
  transport: z.literal("streamable-http"),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

const sseServerSchema = z.object({
  transport: z.literal("sse"),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

const mcpServerSchema = z.discriminatedUnion("transport", [
  stdioServerSchema,
  streamableHttpServerSchema,
  sseServerSchema,
]);

const mcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), mcpServerSchema),
});

export type McpServerConfig = z.infer<typeof mcpServerSchema>;
export type McpConfig = z.infer<typeof mcpConfigSchema>;

/**
 * Loads MCP config from env only:
 * 1) MCP_SERVERS_JSON (inline JSON string)
 * 2) MCP_CONFIG_PATH (file path)
 */
export function loadMcpConfig(): McpConfig {
  const envServers = loadViactMcpServersFromEnv();

  if (process.env.MCP_SERVERS_JSON) {
    const parsed = JSON.parse(process.env.MCP_SERVERS_JSON);
    const loaded = mcpConfigSchema.parse(parsed);
    return {
      mcpServers: {
        ...envServers,
        ...loaded.mcpServers,
      },
    };
  }

  const configPath = process.env.MCP_CONFIG_PATH;
  if (configPath && fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    const loaded = mcpConfigSchema.parse(parsed);
    return {
      mcpServers: {
        ...envServers,
        ...loaded.mcpServers,
      },
    };
  }

  return { mcpServers: envServers };
}

/**
 * Auto-registers viact MCP endpoints from env API keys.
 */
function loadViactMcpServersFromEnv(): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {};

  const kbApiKey = sanitizeHeaderToken(process.env.MCP_VIACT_KB_API_KEY);
  if (kbApiKey) {
    servers.viact_kb = {
      transport: "sse",
      url: "https://kb.viact.net:28866/mcp/sse",
      headers: {
        Authorization: `Bearer ${kbApiKey}`,
      },
    };
  }

  const devApiKey = sanitizeHeaderToken(process.env.MCP_VIACT_DEV_API_KEY);
  if (devApiKey) {
    servers.viact_dev = {
      transport: "streamable-http",
      url: "https://mcp-dev.viact.ai/mcp",
      headers: {
        Authorization: `ApiKey ${devApiKey}`,
      },
    };
  }

  return servers;
}

/**
 * Removes hidden/non-ascii characters that can break downstream auth parsing.
 */
function sanitizeHeaderToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  return token
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .normalize("NFKC")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}
