"use client";

import { useState, useRef, useEffect } from "react";
import { usePortfolio } from "@/lib/hooks/usePortfolio";
import { useMarketSummary } from "@/lib/hooks/useMarket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { X, Send, Loader2, Bot, User, RefreshCw } from "lucide-react";
import { useUiStore } from "@/store/ui";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel() {
  const { chatOpen, setChatOpen } = useUiStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content: "Hi! I'm your CSE Pulse AI assistant. Ask me about the market, your portfolio, or any announcement.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: portfolio } = usePortfolio();
  const { data: market } = useMarketSummary();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send() {
    if (!input.trim() || streaming) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          portfolioJson: portfolio ? JSON.stringify(portfolio.holdings) : "[]",
          marketJson: market
            ? JSON.stringify({
                aspi: market.aspi,
                snp: market.snp,
                status: market.status,
                gainers: market.gainers.slice(0, 5),
                losers: market.losers.slice(0, 5),
              })
            : "{}",
        }),
      });

      if (!res.ok) {
        const j = await res.json();
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: `Error: ${j.error ?? "Failed to get response"}` }
              : msg
          )
        );
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const { text, error } = JSON.parse(data);
            if (error) {
              fullText += `\nError: ${error}`;
            } else if (text) {
              fullText += text;
            }
          } catch {
            // skip malformed chunk
          }
        }

        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: fullText } : msg
          )
        );
      }
    } catch (e) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `Failed to connect to AI: ${String(e)}` }
            : msg
        )
      );
    } finally {
      setStreaming(false);
    }
  }

  if (!chatOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(380px,calc(100vw-2rem))] rounded-xl border bg-background shadow-2xl flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">CSE Pulse AI</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Clear chat"
            onClick={() =>
              setMessages([
                { id: "0", role: "assistant", content: "Chat cleared! How can I help?" },
              ])
            }
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChatOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef as React.RefObject<HTMLDivElement>}>
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex gap-2 text-sm",
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  m.role === "assistant"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {m.role === "assistant" ? (
                  <Bot className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 leading-relaxed whitespace-pre-wrap",
                  m.role === "assistant"
                    ? "bg-muted"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {m.content || (streaming && m.role === "assistant" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
          {[
            "Today's market summary",
            "Analyze my portfolio",
            "Top movers today",
          ].map((q) => (
            <button
              key={q}
              onClick={() => { setInput(q); }}
              className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-accent transition-colors border"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the market or your portfolio..."
          className="text-sm"
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          disabled={streaming}
        />
        <Button size="icon" onClick={send} disabled={!input.trim() || streaming}>
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
