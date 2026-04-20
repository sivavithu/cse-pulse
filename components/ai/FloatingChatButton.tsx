"use client";

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/ui";
import { ChatPanel } from "./ChatPanel";

export function FloatingChat() {
  const { chatOpen, toggleChat } = useUiStore();

  return (
    <>
      {!chatOpen && (
        <Button
          onClick={toggleChat}
          size="icon"
          className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-[22px] shadow-[0_24px_60px_-30px_hsl(var(--primary)/0.9)] md:bottom-6 md:right-6"
          title="Open AI Assistant"
        >
          <Bot className="h-5 w-5" />
        </Button>
      )}
      <ChatPanel />
    </>
  );
}
