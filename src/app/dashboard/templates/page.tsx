import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TemplateForm } from "./template-form";
import { TemplateCard } from "./template-card";

export default async function TemplatesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("property_id, roles(name)")
    .eq("id", user.id)
    .single();

  const rolesData = profile?.roles;
  const roleName = Array.isArray(rolesData)
    ? rolesData[0]?.name
    : (rolesData as unknown as { name: string } | null)?.name;

  if (!["super_admin", "manager", "supervisor"].includes(roleName || "")) {
    redirect("/dashboard");
  }

  // Get areas for the dropdown
  const { data: areas } = await supabase
    .from("areas")
    .select("id, name")
    .order("sort_order");

  // Get all templates with their checklist items
  const { data: templates } = await supabase
    .from("task_templates")
    .select("id, name, description, area_id, cadence, estimated_minutes, required_photos, is_active, areas(name), task_checklist_items(id, label, sort_order)")
    .order("sort_order")
    .order("sort_order", { referencedTable: "task_checklist_items" });

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
        <h2 className="mb-1 text-2xl font-bold text-gray-900">
          Task Templates
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Define cleaning tasks and their checklist steps. These templates are
          used to generate daily tasks for each room.
        </p>

        {/* Create new template form */}
        <TemplateForm areas={areas || []} />

        {/* Existing templates */}
        <h3 className="mb-4 mt-8 text-lg font-semibold text-gray-900">
          Existing Templates ({templates?.length || 0})
        </h3>

        {!templates || templates.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No templates yet. Create your first one above.
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} areas={areas || []} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
