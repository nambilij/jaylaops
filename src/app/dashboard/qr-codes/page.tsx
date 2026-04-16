import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import QRCardGrid from "./qr-card-grid";

export default async function QRCodesPage() {
  const supabase = await createClient();

  // Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check role — only super_admin and manager can access
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

  // Get all units with their QR tokens
  const { data: units } = await supabase
    .from("units")
    .select("id, name, short_code, qr_token")
    .order("sort_order");

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jaylaops.com";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
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
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Room QR Codes</h2>
          <p className="mt-1 text-sm text-gray-500">
            Print these and place one in each room. Guests scan to leave
            feedback.
          </p>
        </div>

        <QRCardGrid units={units || []} baseUrl={baseUrl} />
      </main>
    </div>
  );
}
