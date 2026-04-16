import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get the user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, roles(name, label)")
    .eq("id", user.id)
    .single();

  // Get property info
  const { data: property } = await supabase
    .from("properties")
    .select("name, address, city, country")
    .limit(1)
    .single();

  // Get all units
  const { data: units } = await supabase
    .from("units")
    .select("id, name, short_code, status")
    .order("sort_order");

  const rolesData = profile?.roles;
  const roleName = Array.isArray(rolesData)
    ? rolesData[0]?.name
    : (rolesData as unknown as { name: string } | null)?.name;
  const canManage =
    roleName === "super_admin" ||
    roleName === "manager" ||
    roleName === "supervisor";

  // ---- KPI queries (managers only) ----
  const today = new Date().toISOString().split("T")[0];
  let kpis = { taskCompletion: 0, totalTasks: 0, awaitingInspection: 0, openIssues: 0, urgentFeedback: 0, avgRating: 0, feedbackCount: 0 };

  if (canManage) {
    // Today's tasks
    const { data: todayTasks } = await supabase
      .from("daily_tasks")
      .select("status")
      .eq("scheduled_for", today);

    const total = todayTasks?.length || 0;
    const completed = todayTasks?.filter((t) =>
      ["APPROVED", "AWAITING_INSPECTION"].includes(t.status)
    ).length || 0;
    const awaiting = todayTasks?.filter(
      (t) => t.status === "AWAITING_INSPECTION"
    ).length || 0;

    // Open issues
    const { count: openIssues } = await supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .in("status", ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"]);

    // Urgent feedback (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: urgentCount } = await supabase
      .from("guest_feedback")
      .select("id", { count: "exact", head: true })
      .eq("is_urgent", true)
      .gte("submitted_at", weekAgo);

    // Average rating (last 30 days)
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentFeedback } = await supabase
      .from("guest_feedback")
      .select("ratings")
      .gte("submitted_at", monthAgo);

    let ratingSum = 0;
    let ratingCount = 0;
    (recentFeedback || []).forEach((fb) => {
      const r = fb.ratings as { overall?: number };
      if (r?.overall) {
        ratingSum += r.overall;
        ratingCount++;
      }
    });

    kpis = {
      taskCompletion: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalTasks: total,
      awaitingInspection: awaiting,
      openIssues: openIssues || 0,
      urgentFeedback: urgentCount || 0,
      avgRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0,
      feedbackCount: ratingCount,
    };
  }

  // Navigation links
  const navLinks = canManage
    ? [
        { href: "/dashboard/tasks", label: "Tasks", primary: true },
        { href: "/dashboard/templates", label: "Templates" },
        { href: "/dashboard/issues", label: "Issues" },
        { href: "/dashboard/feedback", label: "Feedback" },
        { href: "/dashboard/reports", label: "Reports" },
        { href: "/dashboard/staff", label: "Staff" },
        { href: "/dashboard/qr-codes", label: "QR Codes" },
        { href: "/dashboard/audit-log", label: "Audit Log" },
      ]
    : [{ href: "/dashboard/tasks", label: "My Tasks", primary: true }];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">JaylaOps</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {profile?.full_name || user.email}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Property header */}
        {property && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {property.name}
            </h2>
            <p className="text-sm text-gray-500">
              {property.address}, {property.city}
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="mb-8 flex flex-wrap gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                link.primary
                  ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  : "rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* KPIs (managers only) */}
        {canManage && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">Task Completion</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {kpis.taskCompletion}%
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {kpis.totalTasks} tasks today
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">Awaiting Inspection</p>
              <p className="mt-1 text-3xl font-bold text-purple-600">
                {kpis.awaitingInspection}
              </p>
              <p className="mt-1 text-xs text-gray-400">tasks to review</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">Open Issues</p>
              <p
                className={`mt-1 text-3xl font-bold ${kpis.openIssues > 0 ? "text-red-600" : "text-green-600"}`}
              >
                {kpis.openIssues}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {kpis.urgentFeedback > 0
                  ? `${kpis.urgentFeedback} urgent feedback this week`
                  : "no urgent feedback this week"}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">Guest Rating</p>
              <p className="mt-1 text-3xl font-bold text-yellow-500">
                {kpis.avgRating > 0 ? `${kpis.avgRating}/5` : "—"}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {kpis.feedbackCount} reviews (30 days)
              </p>
            </div>
          </div>
        )}

        {/* Rooms grid */}
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Rooms ({units?.length || 0})
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {units?.map((unit) => (
            <div
              key={unit.id}
              className="rounded-lg border border-gray-200 bg-white p-4 text-center"
            >
              <h4 className="text-sm font-medium text-gray-900">
                {unit.name}
              </h4>
              <div className="mt-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                    unit.status === "GUEST_READY"
                      ? "bg-green-100 text-green-700"
                      : unit.status === "CLEANED" ||
                          unit.status === "INSPECTED"
                        ? "bg-blue-100 text-blue-700"
                        : unit.status === "IN_PROGRESS"
                          ? "bg-yellow-100 text-yellow-700"
                          : unit.status === "PROBLEM_REPORTED"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {unit.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
