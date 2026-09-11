import { requireViewer } from "@/server/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
