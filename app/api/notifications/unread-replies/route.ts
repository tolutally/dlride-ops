import { getStaff } from "@/lib/auth/staff";
import { fetchUnreadReplyNotifications } from "@/lib/notifications/unread-replies";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getStaff();
  if (!staff) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const snapshot = await fetchUnreadReplyNotifications();
  return Response.json(
    { success: true, data: snapshot },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

