import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { InviteForm } from "./invite-form";
import { StaffRow } from "./staff-row";

export default async function StaffPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get current user's profile to check role
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role_id, property_id, roles(name)")
    .eq("id", user.id)
    .single();

  const myRole = (myProfile?.roles as unknown as { name: string } | null)?.name;
  const canManage = myRole === "super_admin" || myRole === "manager";

  if (!canManage) {
    redirect("/dashboard");
  }

  // Get all staff in the property
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_active, created_at, role_id, tg_user_id, roles(id, name, label)")
    .order("created_at");

  // Get all roles for the invite form
  const { data: roles } = await supabase
    .from("roles")
    .select("id, name, label")
    .order("label");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold text-gray-900">
              JaylaOps
            </Link>
            <span className="text-sm text-gray-400">/</span>
            <h1 className="text-lg font-semibold text-gray-700">Staff</h1>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Invite form */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Invite Staff Member
          </h2>
          <InviteForm roles={roles || []} />
        </div>

        {/* Staff list */}
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Team ({staff?.length || 0})
        </h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Telegram
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {staff?.map((member) => (
                <StaffRow
                  key={member.id}
                  member={member}
                  roles={roles || []}
                  currentUserId={user.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
