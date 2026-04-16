import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GenerateButton } from "./generate-button";
import { TaskRow } from "./task-row";

export default async function TasksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("property_id, roles(name)")
    .eq("id", user.id)
    .single();

  const rolesData = profile?.roles;
  const roleName = Array.isArray(rolesData)
    ? rolesData[0]?.name
    : (rolesData as unknown as { name: string } | null)?.name;

  const isManager = ["super_admin", "manager", "supervisor"].includes(roleName || "");

  // Get today's date in the property timezone
  const today = new Date().toISOString().split("T")[0];

  // Get today's tasks with related data
  const { data: tasks } = await supabase
    .from("daily_tasks")
    .select(
      "id, status, scheduled_for, started_at, completed_at, inspected_at, rejection_reason, assignee_id, checklist_state, units(id, name, short_code), task_templates(id, name, estimated_minutes, required_photos, task_checklist_items(id, label, sort_order)), task_photos(id, storage_path)"
    )
    .eq("scheduled_for", today)
    .order("status");

  // Get housekeepers for assignment dropdown
  const { data: housekeepers } = await supabase
    .from("profiles")
    .select("id, full_name, email, roles(name)")
    .eq("is_active", true);

  // Filter to only housekeepers (and supervisors who can also do tasks)
  const assignableStaff = (housekeepers || []).filter((h) => {
    const rData = h.roles;
    const rName = Array.isArray(rData)
      ? rData[0]?.name
      : (rData as unknown as { name: string } | null)?.name;
    return ["housekeeper", "supervisor"].includes(rName || "");
  });

  // Build a map of assignee names
  const staffMap = new Map(
    (housekeepers || []).map((h) => [h.id, h.full_name || h.email || "Unknown"])
  );

  // Group tasks by status for summary
  const statusCounts: Record<string, number> = {};
  (tasks || []).forEach((t) => {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  });

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
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Today&apos;s Tasks
            </h2>
            <p className="mt-1 text-sm text-gray-500">{today}</p>
          </div>
          {isManager && <GenerateButton date={today} />}
        </div>

        {/* Status summary */}
        {tasks && tasks.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div
                key={status}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  status === "APPROVED"
                    ? "bg-green-100 text-green-700"
                    : status === "AWAITING_INSPECTION"
                      ? "bg-purple-100 text-purple-700"
                      : status === "IN_PROGRESS"
                        ? "bg-yellow-100 text-yellow-700"
                        : status === "REJECTED"
                          ? "bg-red-100 text-red-700"
                          : status === "PENDING"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                }`}
              >
                {status.replace(/_/g, " ")} ({count})
              </div>
            ))}
          </div>
        )}

        {/* Task list */}
        {!tasks || tasks.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No tasks for today.{" "}
            {isManager
              ? "Click \"Generate Today's Tasks\" to create them from your templates."
              : "Your manager will assign tasks to you."}
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                currentUserId={user.id}
                currentUserRole={roleName || ""}
                assignableStaff={assignableStaff.map((s) => ({
                  id: s.id,
                  name: s.full_name || s.email || "Unknown",
                }))}
                staffMap={Object.fromEntries(staffMap)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
