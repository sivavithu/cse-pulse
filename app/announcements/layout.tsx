import { AppShell } from "@/components/layout/AppShell";
import { requireCurrentUserEmail } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireCurrentUserEmail();

  return <AppShell>{children}</AppShell>;
}
