import { tool } from "ai";
import { z } from "zod";

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

/**
 * Web search tool using Tavily Search API.
 */
export const webSearch = tool({
  description:
    "Search the web for information on any topic using Tavily. Use this when the user asks about something not covered by the specialized tools (weather, crypto, GitHub, Hacker News). Returns summary and sources.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "The search query — be specific and include relevant context for better results",
      ),
  }),
  execute: async ({ query }) => {
    try {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        return { error: "Missing TAVILY_API_KEY environment variable." };
      }

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "json-render-chat-example/1.0",
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: "advanced",
          max_results: 5,
          include_answer: true,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        return { error: `Search failed: HTTP ${response.status}` };
      }

      const payload = (await response.json()) as {
        answer?: string;
        query?: string;
        results?: TavilyResult[];
      };

      const sources = (payload.results ?? []).map((result) => ({
        title: result.title ?? result.url ?? "Untitled",
        url: result.url ?? "",
        content: result.content ?? "",
        score: result.score ?? null,
      }));

      return {
        content:
          payload.answer || `Top results for "${payload.query || query}"`,
        sources,
      };
    } catch (error) {
      return {
        error: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
