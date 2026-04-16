import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, roles(name, label)")
    .eq("id", user.id)
    .single();

  const rolesData = profile?.roles;
  const roleLabel = Array.isArray(rolesData)
    ? rolesData[0]?.label
    : (rolesData as unknown as { label: string } | null)?.label;

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

      <main className="mx-auto max-w-lg px-6 py-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Account</h2>

        {/* Profile info */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Profile</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">
                {profile?.full_name || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-900">
                {profile?.email || user.email}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Role</span>
              <span className="font-medium text-gray-900">
                {roleLabel || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Change Password
          </h3>
          <ChangePasswordForm />
        </div>
      </main>
    </div>
  );
}
