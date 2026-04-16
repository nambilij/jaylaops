import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { IssueForm } from "./issue-form";
import { IssueCard } from "./issue-card";

export default async function IssuesPage() {
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

  // Get units for the form dropdown
  const { data: units } = await supabase
    .from("units")
    .select("id, name, short_code")
    .order("sort_order");

  // Get all open/active issues
  const { data: issues } = await supabase
    .from("issues")
    .select(
      "id, title, description, severity, category, status, created_at, updated_at, resolved_at, units(name, short_code), issue_comments(id, body, created_at, author_id)"
    )
    .in("status", ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"])
    .order("created_at", { ascending: false });

  // Get resolved/closed issues
  const { data: closedIssues } = await supabase
    .from("issues")
    .select("id, title, severity, status, resolved_at, closed_at, units(name)")
    .in("status", ["RESOLVED", "CLOSED"])
    .order("updated_at", { ascending: false })
    .limit(20);

  // Get staff for assignee dropdown
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_active", true);

  const staffMap = new Map(
    (staff || []).map((s) => [s.id, s.full_name || s.email || "Unknown"])
  );

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
            <h2 className="text-2xl font-bold text-gray-900">Issues</h2>
            <p className="mt-1 text-sm text-gray-500">
              Track and resolve maintenance problems.
            </p>
          </div>
        </div>

        {/* Report new issue */}
        <IssueForm units={units || []} />

        {/* Active issues */}
        <h3 className="mb-4 mt-8 text-lg font-semibold text-gray-900">
          Active Issues ({issues?.length || 0})
        </h3>

        {!issues || issues.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No active issues. Nice!
          </div>
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                isManager={isManager}
                staff={(staff || []).map((s) => ({
                  id: s.id,
                  name: s.full_name || s.email || "Unknown",
                }))}
                staffMap={Object.fromEntries(staffMap)}
              />
            ))}
          </div>
        )}

        {/* Resolved issues */}
        {closedIssues && closedIssues.length > 0 && (
          <>
            <h3 className="mb-4 mt-8 text-lg font-semibold text-gray-900">
              Resolved ({closedIssues.length})
            </h3>
            <div className="space-y-2">
              {closedIssues.map((issue) => {
                const unit = Array.isArray(issue.units) ? issue.units[0] : issue.units;
                return (
                  <div
                    key={issue.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-3 opacity-60"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {issue.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        {(unit as { name: string } | null)?.name || ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                      {issue.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
