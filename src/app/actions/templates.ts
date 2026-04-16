"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/** Verify the current user is super_admin, manager, or supervisor. */
async function requireSupervisor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role_id, property_id, roles(name)")
    .eq("id", user.id)
    .single();

  const rolesData = profile?.roles;
  const roleName = Array.isArray(rolesData)
    ? rolesData[0]?.name
    : (rolesData as unknown as { name: string } | null)?.name;

  if (!["super_admin", "manager", "supervisor"].includes(roleName || "")) {
    return { error: "Only managers and supervisors can manage templates." };
  }

  return { user, profile, roleName };
}

/** Create a new task template with optional checklist items. */
export async function createTemplate(formData: FormData) {
  const auth = await requireSupervisor();
  if ("error" in auth) return auth;

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const areaId = (formData.get("area_id") as string) || null;
  const cadence = (formData.get("cadence") as string) || "daily";
  const estimatedMinutes = parseInt(formData.get("estimated_minutes") as string) || 30;
  const requiredPhotos = parseInt(formData.get("required_photos") as string) || 1;
  const checklistRaw = formData.get("checklist") as string;

  if (!name) {
    return { error: "Template name is required." };
  }

  const admin = createAdminClient();

  // Create the template
  const { data: template, error: templateError } = await admin
    .from("task_templates")
    .insert({
      property_id: auth.profile!.property_id,
      name,
      description,
      area_id: areaId || null,
      cadence,
      estimated_minutes: estimatedMinutes,
      required_photos: requiredPhotos,
    })
    .select("id")
    .single();

  if (templateError) return { error: templateError.message };

  // Create checklist items if provided
  if (checklistRaw) {
    const items = JSON.parse(checklistRaw) as string[];
    if (items.length > 0) {
      const rows = items.map((label, i) => ({
        template_id: template.id,
        label,
        sort_order: i,
      }));
      await admin.from("task_checklist_items").insert(rows);
    }
  }

  await logAudit({
    actor_id: auth.user.id,
    action: "template.created",
    entity: "task_templates",
    entity_id: template.id,
    diff: { name, cadence },
  });

  revalidatePath("/dashboard/templates");
  return { success: true };
}

/** Update a task template. */
export async function updateTemplate(formData: FormData) {
  const auth = await requireSupervisor();
  if ("error" in auth) return auth;

  const templateId = formData.get("template_id") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const areaId = (formData.get("area_id") as string) || null;
  const cadence = (formData.get("cadence") as string) || "daily";
  const estimatedMinutes = parseInt(formData.get("estimated_minutes") as string) || 30;
  const requiredPhotos = parseInt(formData.get("required_photos") as string) || 1;
  const isActive = formData.get("is_active") !== "false";

  if (!templateId || !name) {
    return { error: "Template ID and name are required." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("task_templates")
    .update({
      name,
      description,
      area_id: areaId || null,
      cadence,
      estimated_minutes: estimatedMinutes,
      required_photos: requiredPhotos,
      is_active: isActive,
    })
    .eq("id", templateId)
    .eq("property_id", auth.profile!.property_id);

  if (error) return { error: error.message };

  await logAudit({
    actor_id: auth.user.id,
    action: "template.updated",
    entity: "task_templates",
    entity_id: templateId,
    diff: { name, cadence, is_active: isActive },
  });

  revalidatePath("/dashboard/templates");
  return { success: true };
}

/** Delete a task template (soft — sets is_active to false). */
export async function deactivateTemplate(formData: FormData) {
  const auth = await requireSupervisor();
  if ("error" in auth) return auth;

  const templateId = formData.get("template_id") as string;
  if (!templateId) return { error: "Template ID is required." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("task_templates")
    .update({ is_active: false })
    .eq("id", templateId)
    .eq("property_id", auth.profile!.property_id);

  if (error) return { error: error.message };

  await logAudit({
    actor_id: auth.user.id,
    action: "template.deactivated",
    entity: "task_templates",
    entity_id: templateId,
  });

  revalidatePath("/dashboard/templates");
  return { success: true };
}
