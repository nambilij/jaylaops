import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ExportButton } from "./export-button";

export default async function ReportsPage() {
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

  if (!["super_admin", "manager"].includes(roleName || "")) {
    redirect("/dashboard");
  }

  // Date range: current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
  const monthLabel = now.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });

  // ---- Staff performance ----
  const { data: allTasks } = await supabase
    .from("daily_tasks")
    .select("assignee_id, status, started_at, completed_at, inspections(score)")
    .gte("scheduled_for", monthStart.split("T")[0])
    .lte("scheduled_for", monthEnd.split("T")[0]);

  const { data: allStaff } = await supabase
    .from("profiles")
    .select("id, full_name, email, roles(name)")
    .eq("is_active", true);

  // Build staff performance map
  const staffPerf: Record<
    string,
    { name: string; assigned: number; completed: number; rejected: number; scores: number[] }
  > = {};

  (allStaff || []).forEach((s) => {
    const rn = Array.isArray(s.roles) ? s.roles[0]?.name : (s.roles as unknown as { name: string } | null)?.name;
    if (rn === "housekeeper" || rn === "supervisor") {
      staffPerf[s.id] = {
        name: s.full_name || s.email || "?",
        assigned: 0,
        completed: 0,
        rejected: 0,
        scores: [],
      };
    }
  });

  (allTasks || []).forEach((t) => {
    if (t.assignee_id && staffPerf[t.assignee_id]) {
      staffPerf[t.assignee_id].assigned++;
      if (t.status === "APPROVED") staffPerf[t.assignee_id].completed++;
      if (t.status === "REJECTED") staffPerf[t.assignee_id].rejected++;
      (t.inspections as { score: number }[] || []).forEach((insp) => {
        if (insp.score) staffPerf[t.assignee_id].scores.push(insp.score);
      });
    }
  });

  const staffRows = Object.values(staffPerf).filter((s) => s.assigned > 0);

  // ---- Unit performance ----
  const { data: unitTasks } = await supabase
    .from("daily_tasks")
    .select("unit_id, status")
    .gte("scheduled_for", monthStart.split("T")[0])
    .lte("scheduled_for", monthEnd.split("T")[0]);

  const { data: unitIssues } = await supabase
    .from("issues")
    .select("unit_id, status, severity")
    .gte("created_at", monthStart);

  const { data: unitFeedback } = await supabase
    .from("guest_feedback")
    .select("unit_id, ratings, is_urgent")
    .gte("submitted_at", monthStart);

  const { data: allUnits } = await supabase
    .from("units")
    .select("id, name")
    .order("sort_order");

  const unitPerf: Record<
    string,
    { name: string; tasks: number; completed: number; issues: number; urgentFb: number; ratings: number[] }
  > = {};

  (allUnits || []).forEach((u) => {
    unitPerf[u.id] = { name: u.name, tasks: 0, completed: 0, issues: 0, urgentFb: 0, ratings: [] };
  });

  (unitTasks || []).forEach((t) => {
    if (t.unit_id && unitPerf[t.unit_id]) {
      unitPerf[t.unit_id].tasks++;
      if (t.status === "APPROVED") unitPerf[t.unit_id].completed++;
    }
  });

  (unitIssues || []).forEach((i) => {
    if (i.unit_id && unitPerf[i.unit_id]) unitPerf[i.unit_id].issues++;
  });

  (unitFeedback || []).forEach((fb) => {
    if (fb.unit_id && unitPerf[fb.unit_id]) {
      if (fb.is_urgent) unitPerf[fb.unit_id].urgentFb++;
      const r = fb.ratings as { overall?: number };
      if (r?.overall) unitPerf[fb.unit_id].ratings.push(r.overall);
    }
  });

  const unitRows = Object.values(unitPerf);

  // ---- Feedback summary ----
  const totalFeedback = unitFeedback?.length || 0;
  const urgentTotal = unitFeedback?.filter((f) => f.is_urgent).length || 0;
  let allRatings: number[] = [];
  (unitFeedback || []).forEach((fb) => {
    const r = fb.ratings as { overall?: number };
    if (r?.overall) allRatings.push(r.overall);
  });
  const avgOverall = allRatings.length > 0
    ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
    : 0;

  // ---- Issues summary ----
  const totalIssues = unitIssues?.length || 0;
  const resolvedIssues = unitIssues?.filter((i) => ["RESOLVED", "CLOSED"].includes(i.status)).length || 0;
  const urgentIssues = unitIssues?.filter((i) => i.severity === "urgent").length || 0;

  // CSV data for export
  const csvData = {
    staffRows: staffRows.map((s) => ({
      name: s.name,
      assigned: s.assigned,
      completed: s.completed,
      rejected: s.rejected,
      avgScore: s.scores.length > 0 ? (s.scores.reduce((a, b) => a + b, 0) / s.scores.length).toFixed(1) : "N/A",
    })),
    unitRows: unitRows.map((u) => ({
      name: u.name,
      tasks: u.tasks,
      completed: u.completed,
      issues: u.issues,
      urgentFeedback: u.urgentFb,
      avgRating: u.ratings.length > 0 ? (u.ratings.reduce((a, b) => a + b, 0) / u.ratings.length).toFixed(1) : "N/A",
    })),
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
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Monthly Report</h2>
            <p className="mt-1 text-sm text-gray-500">{monthLabel}</p>
          </div>
          <ExportButton csvData={JSON.stringify(csvData)} month={monthLabel} />
        </div>

        {/* Executive summary */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Total Tasks</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {allTasks?.length || 0}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Avg Guest Rating</p>
            <p className="mt-1 text-2xl font-bold text-yellow-500">
              {avgOverall > 0 ? `${avgOverall}/5` : "—"}
            </p>
            <p className="text-xs text-gray-400">{totalFeedback} reviews</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Issues</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {totalIssues}
            </p>
            <p className="text-xs text-gray-400">
              {resolvedIssues} resolved, {urgentIssues} urgent
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Urgent Feedback</p>
            <p
              className={`mt-1 text-2xl font-bold ${urgentTotal > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {urgentTotal}
            </p>
          </div>
        </div>

        {/* Staff performance */}
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Staff Performance
        </h3>
        {staffRows.length === 0 ? (
          <p className="mb-8 text-sm text-gray-500">
            No task data for staff this month.
          </p>
        ) : (
          <div className="mb-8 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Assigned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Rejected
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Avg Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffRows.map((s) => (
                  <tr key={s.name}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {s.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {s.assigned}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {s.completed}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {s.rejected}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {s.scores.length > 0
                        ? (
                            s.scores.reduce((a, b) => a + b, 0) / s.scores.length
                          ).toFixed(1)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Unit performance */}
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Unit Performance
        </h3>
        <div className="mb-8 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Room
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Tasks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Completed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Issues
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Urgent FB
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Avg Rating
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {unitRows.map((u) => (
                <tr key={u.name}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {u.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {u.tasks}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {u.completed}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {u.issues}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {u.urgentFb > 0 ? (
                      <span className="text-red-600">{u.urgentFb}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {u.ratings.length > 0
                      ? (
                          u.ratings.reduce((a, b) => a + b, 0) /
                          u.ratings.length
                        ).toFixed(1)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
