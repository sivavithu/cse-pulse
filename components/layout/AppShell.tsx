import { Sidebar, MobileSidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { FloatingChat } from "@/components/ai/FloatingChatButton";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <Sidebar />
      <MobileSidebar />
      <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <div className="mx-auto min-h-full w-full max-w-[1600px] px-4 pb-8 pt-4 md:px-6 md:pb-10 md:pt-6">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
      <FloatingChat />
    </div>
  );
}
