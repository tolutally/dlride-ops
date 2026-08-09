import { AppShell } from "@/components/app-shell/app-shell";
import { requireStaff } from "@/lib/auth/staff";
import { fetchUnreadReplyNotifications } from "@/lib/notifications/unread-replies";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const staff = await requireStaff();
  const initialNotifications = await fetchUnreadReplyNotifications();
  return (
    <AppShell staffEmail={staff.email} initialNotifications={initialNotifications}>
      {children}
    </AppShell>
  );
}
