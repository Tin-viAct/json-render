"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { JsonEditor, type JsonValue } from "@visual-json/react";
import type { NextAppSpec } from "@json-render/next";
import { NextAppProvider, PageRenderer } from "@json-render/next";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { AddressBar } from "@/components/route-tabs";
import { registry } from "@/lib/registry";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function Editor() {
  const [spec, setSpec] = useState<NextAppSpec | null>(null);
  const [activeRoute, setActiveRoute] = useState("/");
  const [jsonSidebarOpen, setJsonSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I can fetch data (for example VNINDEX prices) and build dashboard UI from it. Try: Build a dashboard of stock pricing of VNINDEX over 30 days.",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/spec")
      .then((r) => r.json())
      .then((data: NextAppSpec) => setSpec(data));
  }, []);

  const handleChange = useCallback((value: JsonValue) => {
    const updated = value as unknown as NextAppSpec;
    setSpec(updated);
    setChatError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch("/api/spec", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    }, 500);
  }, []);

  const handleChatSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!prompt.trim() || !spec || isSending) return;

      const userMessage: ChatMessage = { role: "user", content: prompt.trim() };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setPrompt("");
      setIsSending(true);
      setChatError(null);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages,
            spec,
          }),
        });
        const payload = (await response.json()) as {
          ok: boolean;
          message?: string;
          error?: string;
          spec?: NextAppSpec;
        };

        if (!response.ok || !payload.ok || !payload.spec) {
          throw new Error(payload.error || "Chat update failed.");
        }

        setSpec(payload.spec);
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: payload.message || "Updated." },
        ]);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error.";
        setChatError(message);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, messages, prompt, spec],
  );

  const handlePreviewClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("mailto:")) return;
    e.preventDefault();
    setActiveRoute(href);
  }, []);

  const currentRoute = useMemo(() => {
    if (!spec) return null;
    return spec.routes[activeRoute] ?? null;
  }, [spec, activeRoute]);

  const layoutSpec = useMemo(() => {
    if (!spec || !currentRoute?.layout || !spec.layouts) return null;
    return spec.layouts[currentRoute.layout] ?? null;
  }, [spec, currentRoute]);

  const initialState = useMemo(() => {
    if (!spec || !currentRoute) return undefined;
    const merged: Record<string, unknown> = {};
    if (spec.state) Object.assign(merged, spec.state);
    if (currentRoute.page.state) Object.assign(merged, currentRoute.page.state);
    return Object.keys(merged).length > 0 ? merged : undefined;
  }, [spec, currentRoute]);

  if (!spec) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-background shrink-0">
        <span className="text-sm font-semibold">
          Interactive Chat-to-UI POC
        </span>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View Website
        </a>
      </div>
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={28} minSize={20}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-3 h-10 border-b border-border bg-muted/30">
              <span className="text-xs font-mono text-muted-foreground">
                chat
              </span>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {chatError ? (
                <div className="rounded-md px-3 py-2 text-sm bg-destructive/10 text-destructive">
                  {chatError}
                </div>
              ) : null}
            </div>
            <form
              onSubmit={handleChatSubmit}
              className="border-t border-border p-3 flex items-end gap-2"
            >
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="w-full min-h-20 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Example: Build a dashboard of stock pricing of VNINDEX over 30 days."
              />
              <button
                type="submit"
                disabled={isSending || !prompt.trim()}
                className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </form>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={72} minSize={30}>
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={55} minSize={25}>
              <div className="h-full flex flex-col">
                <AddressBar route={activeRoute} onNavigate={setActiveRoute} />
                <div
                  className="flex-1 overflow-auto bg-background"
                  onClick={handlePreviewClick}
                >
                  {currentRoute ? (
                    <NextAppProvider registry={registry}>
                      <PageRenderer
                        spec={currentRoute.page}
                        initialState={initialState}
                        layoutSpec={layoutSpec}
                      />
                    </NextAppProvider>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Route not found
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={45} minSize={25}>
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-3 h-10 border-b border-border bg-muted/30">
                  <span className="text-xs font-mono text-muted-foreground">
                    spec.json
                  </span>
                  <button
                    onClick={() => setJsonSidebarOpen((v) => !v)}
                    className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={jsonSidebarOpen ? "Hide sidebar" : "Show sidebar"}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 3v18" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <JsonEditor
                    value={spec as unknown as JsonValue}
                    onChange={handleChange}
                    sidebarOpen={jsonSidebarOpen}
                    height="100%"
                    className="h-full"
                    style={
                      {
                        "--vj-bg": "var(--background)",
                        "--vj-bg-panel": "var(--background)",
                        "--vj-bg-hover": "var(--muted)",
                        "--vj-bg-selected": "var(--primary)",
                        "--vj-bg-selected-muted": "var(--muted)",
                        "--vj-text": "var(--foreground)",
                        "--vj-text-selected": "var(--primary-foreground)",
                        "--vj-text-muted": "var(--muted-foreground)",
                        "--vj-text-dim": "var(--muted-foreground)",
                        "--vj-border": "var(--border)",
                        "--vj-border-subtle": "var(--border)",
                        "--vj-accent": "var(--primary)",
                        "--vj-accent-muted": "var(--muted)",
                        "--vj-input-bg": "var(--secondary)",
                        "--vj-input-border": "var(--border)",
                      } as React.CSSProperties
                    }
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
