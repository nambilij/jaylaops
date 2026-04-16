import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import Link from "next/link";
import {
  TaskIcon,
  InspectionIcon,
  IssueIcon,
  StarIcon,
  NavTasksIcon,
  NavTemplatesIcon,
  NavIssuesIcon,
  NavFeedbackIcon,
  NavReportsIcon,
  NavStaffIcon,
  NavQRIcon,
  NavAuditIcon,
} from "@/app/components/illustrations";

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

  // Navigation links with icons
  const navLinks = canManage
    ? [
        { href: "/dashboard/tasks", label: "Tasks", icon: NavTasksIcon, primary: true },
        { href: "/dashboard/templates", label: "Templates", icon: NavTemplatesIcon },
        { href: "/dashboard/issues", label: "Issues", icon: NavIssuesIcon },
        { href: "/dashboard/feedback", label: "Feedback", icon: NavFeedbackIcon },
        { href: "/dashboard/reports", label: "Reports", icon: NavReportsIcon },
        { href: "/dashboard/staff", label: "Staff", icon: NavStaffIcon },
        { href: "/dashboard/qr-codes", label: "QR Codes", icon: NavQRIcon },
        { href: "/dashboard/audit-log", label: "Audit Log", icon: NavAuditIcon },
      ]
    : [{ href: "/dashboard/tasks", label: "My Tasks", icon: NavTasksIcon, primary: true }];

  return (
    <div className="min-h-screen bg-brand-50">
      {/* Top bar */}
      <header className="border-b border-brand-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold text-brand-900">JaylaOps</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/account"
              className="text-sm text-brand-600 hover:text-brand-900"
            >
              {profile?.full_name || user.email}
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50"
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
            <h2 className="text-2xl font-bold text-brand-900">
              {property.name}
            </h2>
            <p className="text-sm text-brand-600">
              {property.address}, {property.city}
            </p>
          </div>
        )}

        {/* Navigation with icons */}
        <div className="mb-8 flex flex-wrap gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.primary
                    ? "inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 transition-colors"
                    : "inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm text-brand-700 hover:bg-brand-50 transition-colors"
                }
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* KPIs (managers only) */}
        {canManage && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <TaskIcon className="h-5 w-5 text-brand-500" />
                <p className="text-sm text-brand-600">Task Completion</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-brand-900">
                {kpis.taskCompletion}%
              </p>
              <p className="mt-1 text-xs text-brand-500">
                {kpis.totalTasks} tasks today
              </p>
            </div>
            <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <InspectionIcon className="h-5 w-5 text-purple-500" />
                <p className="text-sm text-brand-600">Awaiting Inspection</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-purple-600">
                {kpis.awaitingInspection}
              </p>
              <p className="mt-1 text-xs text-brand-500">tasks to review</p>
            </div>
            <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <IssueIcon className="h-5 w-5 text-red-500" />
                <p className="text-sm text-brand-600">Open Issues</p>
              </div>
              <p
                className={`mt-2 text-3xl font-bold ${kpis.openIssues > 0 ? "text-red-600" : "text-green-600"}`}
              >
                {kpis.openIssues}
              </p>
              <p className="mt-1 text-xs text-brand-500">
                {kpis.urgentFeedback > 0
                  ? `${kpis.urgentFeedback} urgent feedback this week`
                  : "no urgent feedback this week"}
              </p>
            </div>
            <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <StarIcon className="h-5 w-5 text-yellow-500" />
                <p className="text-sm text-brand-600">Guest Rating</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-yellow-500">
                {kpis.avgRating > 0 ? `${kpis.avgRating}/5` : "\u2014"}
              </p>
              <p className="mt-1 text-xs text-brand-500">
                {kpis.feedbackCount} reviews (30 days)
              </p>
            </div>
          </div>
        )}

        {/* Rooms grid */}
        <h3 className="mb-4 text-lg font-semibold text-brand-900">
          Rooms ({units?.length || 0})
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {units?.map((unit) => (
            <div
              key={unit.id}
              className="rounded-xl border border-brand-200 bg-white p-4 text-center shadow-sm"
            >
              <h4 className="text-sm font-medium text-brand-900">
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
                            : "bg-brand-100 text-brand-700"
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
