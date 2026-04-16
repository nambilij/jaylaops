import { createAdminClient } from "@/lib/supabase/admin";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/**
 * Send a Telegram message to a user by their profile ID.
 * Looks up their tg_user_id, sends the message, and logs it
 * in the notifications table.
 *
 * Returns silently if the user hasn't linked Telegram.
 */
export async function notifyUser({
  userId,
  templateKey,
  message,
}: {
  userId: string;
  templateKey: string;
  message: string;
}) {
  const admin = createAdminClient();

  // Look up Telegram user ID
  const { data: profile } = await admin
    .from("profiles")
    .select("tg_user_id")
    .eq("id", userId)
    .single();

  if (!profile?.tg_user_id) return; // User hasn't linked Telegram

  // Send the message
  let sentOk = false;
  let errorMsg: string | null = null;

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: profile.tg_user_id,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    const data = await res.json();
    sentOk = data.ok === true;
    if (!sentOk) errorMsg = data.description || "Unknown error";
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Network error";
  }

  // Log in notifications table
  await admin.from("notifications").insert({
    channel: "telegram",
    recipient_user_id: userId,
    template_key: templateKey,
    payload: { message },
    sent_at: sentOk ? new Date().toISOString() : null,
    delivered_at: sentOk ? new Date().toISOString() : null,
    error: errorMsg,
  });
}

/**
 * Notify all managers/supervisors in a property.
 */
export async function notifyManagers({
  propertyId,
  templateKey,
  message,
}: {
  propertyId: string;
  templateKey: string;
  message: string;
}) {
  const admin = createAdminClient();

  const { data: managers } = await admin
    .from("profiles")
    .select("id, roles(name)")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .not("tg_user_id", "is", null);

  if (!managers) return;

  for (const mgr of managers) {
    const roleName = Array.isArray(mgr.roles)
      ? mgr.roles[0]?.name
      : (mgr.roles as unknown as { name: string } | null)?.name;

    if (["super_admin", "manager", "supervisor"].includes(roleName || "")) {
      await notifyUser({ userId: mgr.id, templateKey, message });
    }
  }
}
