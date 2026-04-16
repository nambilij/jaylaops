import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Write an entry to the audit_logs table.
 *
 * Uses the admin (service-role) client so it bypasses RLS —
 * the audit table has no INSERT policy for regular users.
 *
 * @param actor_id  - UUID of the user who performed the action
 * @param action    - what happened, e.g. "user.invited", "staff.role_changed"
 * @param entity    - table name, e.g. "profiles", "units"
 * @param entity_id - primary key of the affected row
 * @param diff      - optional JSON describing what changed
 * @param ip        - optional request IP
 * @param ua        - optional user agent
 */
export async function logAudit({
  actor_id,
  action,
  entity,
  entity_id,
  diff = {},
  ip,
  ua,
}: {
  actor_id: string;
  action: string;
  entity: string;
  entity_id?: string;
  diff?: Record<string, unknown>;
  ip?: string;
  ua?: string;
}) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id,
    action,
    entity,
    entity_id,
    diff,
    ip,
    ua,
  });
}
