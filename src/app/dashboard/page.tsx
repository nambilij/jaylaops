import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Check if user is logged in
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

  // Get property info (using service-level query since RLS may not have property_id set yet)
  const { data: property } = await supabase
    .from("properties")
    .select("name, address, city, country")
    .limit(1)
    .single();

  // Get all units
  const { data: units, error: unitsError } = await supabase
    .from("units")
    .select("id, name, short_code, status")
    .order("sort_order");

  const rolesData = profile?.roles;
  const roleName = Array.isArray(rolesData)
    ? rolesData[0]?.name
    : (rolesData as unknown as { name: string } | null)?.name;
  const canManage = roleName === "super_admin" || roleName === "manager";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">JaylaOps</h1>
          <div className="flex items-center gap-4">
            {canManage && (
              <>
                <Link
                  href="/dashboard/tasks"
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Today&apos;s Tasks
                </Link>
                <Link
                  href="/dashboard/templates"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Templates
                </Link>
                <Link
                  href="/dashboard/qr-codes"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  QR Codes
                </Link>
                <Link
                  href="/dashboard/staff"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Manage Staff
                </Link>
                <Link
                  href="/dashboard/audit-log"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Audit Log
                </Link>
              </>
            )}
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

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Property info */}
        {property && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {property.name}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {property.address}, {property.city}, {property.country}
            </p>
          </div>
        )}

        {/* Units grid */}
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Rooms ({units?.length || 0})
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units?.map((unit) => (
            <div
              key={unit.id}
              className="rounded-lg border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">{unit.name}</h4>
                <span className="text-xs font-medium text-gray-400">
                  {unit.short_code}
                </span>
              </div>
              <div className="mt-3">
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
                  {unit.status.replace("_", " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
