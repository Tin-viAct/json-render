# Chat Example with MCP Tool Calling

This example supports:
- built-in tools (weather, GitHub, crypto, HN, Tavily web search, stocks),
- user-provided MCP tools loaded from MCP config.

## Run

From repo root:

```bash
pnpm --filter example-chat dev
```

## Environment

Set in `examples/chat/.env` or `.env.local`:

- `GOOGLE_GENERATIVE_AI_API_KEY` (or AI Gateway vars)
- `TAVILY_API_KEY` for web search tool

Optional:
- `MCP_SERVERS_JSON` inline JSON config string
- `MCP_CONFIG_PATH` path to an MCP config file
- `MCP_VIACT_KB_API_KEY` for `https://kb.viact.net:28866/mcp/sse`
- `MCP_VIACT_DEV_API_KEY` for `https://mcp-dev.viact.ai/mcp`

## MCP Config

Chat loads MCP config from env only, in this order:
1. Auto viact servers from `MCP_VIACT_KB_API_KEY` and `MCP_VIACT_DEV_API_KEY`
2. `MCP_SERVERS_JSON` (if set)
3. `MCP_CONFIG_PATH` (if set and file exists)

Expected shape:

```json
{
  "mcpServers": {
    "yourServerName": {
      "command": "npx",
      "args": ["-y", "your-mcp-server-package"],
      "env": {
        "YOUR_TOKEN": "..."
      }
    }
  }
}
```

## How MCP Tools Are Exposed

- Each discovered MCP tool is namespaced as:
  - `mcp_<server>_<tool>`
- Agent can call them alongside built-in tools.
- In chat UI, MCP tool calls appear as:
  - `Calling MCP <server> · <tool>`
  - expandable result payload when complete.

## Troubleshooting

- If tools do not appear:
  - verify `MCP_SERVERS_JSON` / `MCP_CONFIG_PATH` value and JSON validity,
  - ensure MCP command works manually,
  - confirm required env vars are set in config `env`.
- If one MCP server fails:
  - chat still runs; only that server's tools are skipped.
