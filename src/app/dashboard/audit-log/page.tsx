import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AuditLogPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check role — only super_admin and manager can view audit logs
  const { data: profile } = await supabase
    .from("profiles")
    .select("roles(name)")
    .eq("id", user.id)
    .single();

  const rolesData = profile?.roles;
  const roleName = Array.isArray(rolesData)
    ? rolesData[0]?.name
    : (rolesData as unknown as { name: string } | null)?.name;

  if (roleName !== "super_admin" && roleName !== "manager") {
    redirect("/dashboard");
  }

  // Fetch the most recent 100 audit log entries
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity, entity_id, diff, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  // Get actor names for display
  const actorIds = [...new Set((logs || []).map((l) => l.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds)
    : { data: [] };

  const actorMap = new Map(
    (actors || []).map((a) => [a.id, a.full_name || a.email || "Unknown"])
  );

  // Human-readable labels for actions
  const actionLabels: Record<string, string> = {
    "auth.login": "Logged in",
    "auth.signup": "Signed up",
    "user.invited": "Invited a staff member",
    "staff.role_changed": "Changed a staff role",
    "staff.activated": "Activated a staff member",
    "staff.deactivated": "Deactivated a staff member",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">JaylaOps</h1>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <h2 className="mb-1 text-2xl font-bold text-gray-900">Audit Log</h2>
        <p className="mb-6 text-sm text-gray-500">
          A record of all actions taken in the system. This log is
          append-only and cannot be edited or deleted.
        </p>

        {!logs || logs.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No audit entries yet. Actions will appear here as people use the
            system.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    When
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Who
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString("en-ZA", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {actorMap.get(log.actor_id) || "System"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {actionLabels[log.action] || log.action}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.diff &&
                        Object.keys(log.diff).length > 0 && (
                          <code className="rounded bg-gray-100 px-2 py-1 text-xs">
                            {JSON.stringify(log.diff)}
                          </code>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
