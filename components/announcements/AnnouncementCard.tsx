"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ExternalLink, Bot, AlertTriangle, Send, User, RefreshCw } from "lucide-react";
import type { Announcement, AnnouncementCategory } from "@/lib/cse/types";
import { normalizeAnnouncement, categorizeAnnouncement } from "@/lib/cse/normalize";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<AnnouncementCategory, string> = {
  rights: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  dividend: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  financial: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  corporate: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  listing: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  circular: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  other: "bg-muted text-muted-foreground",
};

const INITIAL_PROMPT =
  "Explain this announcement in simple English for a retail investor. What is happening, why does it matter, what should I watch out for, and what could be the share-price impact?";

interface Props {
  announcement: Announcement;
  userHoldings?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AnnouncementCard({ announcement: raw, userHoldings }: Props) {
  const normalized =
    typeof raw === "object" && "category" in raw
      ? raw
      : normalizeAnnouncement(raw as Record<string, unknown>);

  const announcement = {
    ...normalized,
    category: categorizeAnnouncement(
      [normalized.subject, normalized.rawText ?? "", normalized.companyName].filter(Boolean).join(" ")
    ),
  };

  const [explainOpen, setExplainOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function streamConversation(
    requestMessages: Array<{ role: "user" | "assistant"; content: string }>,
    assistantId: string
  ) {
    setLoading(true);

    try {
      const res = await fetch("/api/gemini/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: requestMessages,
          announcement: `${announcement.subject}\n${announcement.rawText ?? ""}`,
          companyName: announcement.companyName || announcement.symbol,
          holdings: userHoldings ?? "",
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: `Error: ${payload.error ?? "Failed to get response"}` }
              : message
          )
        );
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No response stream from Gemini");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event
            .split("\n")
            .find((entry) => entry.startsWith("data: "));

          if (!line) continue;

          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const payload = JSON.parse(data) as { text?: string; error?: string };
            if (payload.error) {
              fullText += `\nError: ${payload.error}`;
            } else if (payload.text) {
              fullText += payload.text;
            }
          } catch {
            // Ignore malformed chunks.
          }
        }

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: fullText } : message
          )
        );
      }
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, content: `Failed to connect to Gemini: ${String(error)}` }
            : message
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function startExplanation() {
    setExplainOpen(true);
    if (messages.length || loading) return;

    const assistantId = `assistant-${Date.now()}`;
    setMessages([{ id: assistantId, role: "assistant", content: "" }]);
    void streamConversation([{ role: "user", content: INITIAL_PROMPT }], assistantId);
  }

  function resetConversation() {
    if (loading) return;
    setMessages([]);
    setInput("");

    const assistantId = `assistant-${Date.now()}`;
    setMessages([{ id: assistantId, role: "assistant", content: "" }]);
    void streamConversation([{ role: "user", content: INITIAL_PROMPT }], assistantId);
  }

  function sendFollowUp() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };
    const assistantId = `assistant-${Date.now() + 1}`;
    const nextMessages = [...messages, userMessage];

    setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");

    void streamConversation(
      nextMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      assistantId
    );
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-2 flex-wrap">
            <Badge className={cn("text-xs shrink-0", CATEGORY_COLORS[announcement.category])} variant="secondary">
              {announcement.category}
            </Badge>
            {announcement.symbol && (
              <Badge variant="outline" className="text-xs font-mono shrink-0">{announcement.symbol}</Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto shrink-0">{announcement.date}</span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium leading-snug mb-2">{announcement.subject}</p>
          {announcement.companyName && (
            <p className="text-xs text-muted-foreground mb-3">{announcement.companyName}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={startExplanation} className="text-xs gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              Explain with Gemini
            </Button>
            {announcement.pdfUrl && (
              <a
                href={announcement.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-accent transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View PDF
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Gemini Explanation
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 min-h-0 flex flex-col">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Announcement</p>
              <p className="text-sm font-medium">{announcement.subject}</p>
              {announcement.companyName && (
                <p className="text-xs text-muted-foreground mt-1">{announcement.companyName}</p>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 min-h-[280px] max-h-[50vh] overflow-y-auto rounded-lg border bg-background p-3">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2 text-sm",
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div
                      className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        message.role === "assistant"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <Bot className="h-3.5 w-3.5" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[88%] rounded-xl px-3 py-2 leading-relaxed whitespace-pre-wrap",
                        message.role === "assistant"
                          ? "bg-muted"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {message.content || (loading && message.role === "assistant" && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ))}
                    </div>
                  </div>
                ))}

                {!messages.length && !loading && (
                  <p className="text-sm text-muted-foreground">Ask Gemini to explain this announcement.</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Continue asking about this announcement..."
                className="text-sm"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendFollowUp();
                  }
                }}
                disabled={loading || !messages.length}
              />
              <Button size="icon" variant="outline" onClick={resetConversation} disabled={loading} title="Restart explanation">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="icon" onClick={sendFollowUp} disabled={!input.trim() || loading || !messages.length}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              AI-generated analysis. Not financial advice. Verify with official sources.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
