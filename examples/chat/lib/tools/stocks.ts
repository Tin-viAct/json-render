import { tool } from "ai";
import { z } from "zod";

const INPUT_SCHEMA = z.object({
  symbol: z.string().default("VNINDEX"),
  days: z.number().int().min(5).max(90).default(30),
});

type YahooPayload = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

/**
 * Fetches OHLCV pricing data for VNINDEX from Yahoo Finance.
 */
export const getStockHistory = tool({
  description:
    "Get historical stock/index prices with OHLCV data. Use symbol 'VNINDEX' for Vietnam index.",
  inputSchema: INPUT_SCHEMA,
  execute: async ({ symbol, days }) => {
    const normalizedSymbol = symbol.toUpperCase();
    const tickerCandidates =
      normalizedSymbol === "VNINDEX"
        ? ["%5EVNINDEX", "^VNINDEX", "VNINDEX.VN", "VNI"]
        : [symbol];
    const range = days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";

    try {
      let payload: YahooPayload | null = null;
      let lastStatus: number | null = null;

      for (const ticker of tickerCandidates) {
        const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d`;
        const response = await fetch(endpoint, {
          headers: {
            "User-Agent": "json-render-chat-example/1.0",
            Accept: "application/json",
          },
        });

        lastStatus = response.status;
        if (!response.ok) {
          continue;
        }

        const candidatePayload = (await response.json()) as YahooPayload;
        const hasResult = Boolean(
          candidatePayload?.chart?.result?.[0]?.timestamp?.length,
        );
        if (hasResult) {
          payload = candidatePayload;
          break;
        }
      }

      if (!payload) {
        return {
          error:
            normalizedSymbol === "VNINDEX"
              ? `Failed to fetch VNINDEX price series from public endpoint (status ${lastStatus ?? "unknown"}).`
              : `Failed to fetch stock data for ${normalizedSymbol} (status ${lastStatus ?? "unknown"}).`,
        };
      }

      const result = payload.chart?.result?.[0];
      const timestamps = result?.timestamp ?? [];
      const quote = result?.indicators?.quote?.[0];
      const closes = quote?.close ?? [];
      const opens = quote?.open ?? [];
      const highs = quote?.high ?? [];
      const lows = quote?.low ?? [];
      const volumes = quote?.volume ?? [];

      const points = timestamps
        .map((timestamp: number, index: number) => {
          const close = closes[index];
          if (typeof close !== "number") return null;
          return {
            date: new Date(timestamp * 1000).toISOString().slice(0, 10),
            open:
              typeof opens[index] === "number"
                ? Number(opens[index]?.toFixed(2))
                : null,
            high:
              typeof highs[index] === "number"
                ? Number(highs[index]?.toFixed(2))
                : null,
            low:
              typeof lows[index] === "number"
                ? Number(lows[index]?.toFixed(2))
                : null,
            close: Number(close.toFixed(2)),
            volume:
              typeof volumes[index] === "number"
                ? Math.trunc(volumes[index] as number)
                : null,
          };
        })
        .filter(
          (
            item,
          ): item is {
            date: string;
            open: number | null;
            high: number | null;
            low: number | null;
            close: number;
            volume: number | null;
          } => item !== null,
        )
        .slice(-days);

      const first = points[0];
      const latest = points[points.length - 1];
      const change =
        first && latest
          ? Number((latest.close - first.close).toFixed(2))
          : null;
      const changePercent =
        first && latest && first.close !== 0
          ? Number(
              (((latest.close - first.close) / first.close) * 100).toFixed(2),
            )
          : null;

      return {
        symbol: normalizedSymbol,
        points,
        summary: {
          latestClose: latest?.close ?? null,
          firstClose: first?.close ?? null,
          change,
          changePercent,
          high: points.length
            ? Math.max(...points.map((point) => point.close))
            : null,
          low: points.length
            ? Math.min(...points.map((point) => point.close))
            : null,
        },
      };
    } catch (error) {
      return {
        error: `Stock fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
