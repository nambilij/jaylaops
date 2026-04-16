"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { notifyManagers, notifyUser } from "@/lib/telegram/notify";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role_id, property_id, full_name, roles(name)")
    .eq("id", user.id)
    .single();

  const rolesData = profile?.roles;
  const roleName = Array.isArray(rolesData)
    ? rolesData[0]?.name
    : (rolesData as unknown as { name: string } | null)?.name;

  return { user, profile, roleName };
}

/** Create a new issue. */
export async function createIssue(formData: FormData) {
  const auth = await requireAuth();

  const unitId = formData.get("unit_id") as string;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const severity = (formData.get("severity") as string) || "medium";
  const category = (formData.get("category") as string)?.trim() || null;

  if (!title) return { error: "Title is required." };

  const admin = createAdminClient();

  const { data: issue, error } = await admin
    .from("issues")
    .insert({
      property_id: auth.profile!.property_id,
      unit_id: unitId || null,
      reported_by: auth.user.id,
      reporter_type: "staff",
      title,
      description,
      severity,
      category,
      status: "OPEN",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    actor_id: auth.user.id,
    action: "issue.created",
    entity: "issues",
    entity_id: issue.id,
    diff: { title, severity, category },
  });

  // Notify managers if urgent
  if (severity === "urgent" || severity === "high") {
    const { data: unitInfo } = unitId
      ? await admin.from("units").select("name").eq("id", unitId).single()
      : { data: null };

    await notifyManagers({
      propertyId: auth.profile!.property_id,
      templateKey: "issue.created",
      message:
        `🚨 *New ${severity.toUpperCase()} Issue*\n\n` +
        `${unitInfo?.name ? `🏠 ${unitInfo.name}\n` : ""}` +
        `📝 ${title}\n` +
        `${description ? `${description}\n` : ""}` +
        `\nReported by: ${auth.profile?.full_name || auth.user.email}`,
    });
  }

  revalidatePath("/dashboard/issues");
  return { success: true };
}

/** Update issue status. */
export async function updateIssueStatus(formData: FormData) {
  const auth = await requireAuth();
  const isManager = ["super_admin", "manager", "supervisor"].includes(auth.roleName || "");
  if (!isManager) return { error: "Only managers can update issues." };

  const issueId = formData.get("issue_id") as string;
  const status = formData.get("status") as string;
  const assigneeId = (formData.get("assignee_id") as string) || null;

  if (!issueId || !status) return { error: "Issue ID and status are required." };

  const admin = createAdminClient();

  const updates: Record<string, unknown> = { status };
  if (assigneeId) updates.assignee_id = assigneeId;
  if (status === "RESOLVED") updates.resolved_at = new Date().toISOString();
  if (status === "CLOSED") updates.closed_at = new Date().toISOString();

  const { error } = await admin
    .from("issues")
    .update(updates)
    .eq("id", issueId)
    .eq("property_id", auth.profile!.property_id);

  if (error) return { error: error.message };

  await logAudit({
    actor_id: auth.user.id,
    action: "issue.status_changed",
    entity: "issues",
    entity_id: issueId,
    diff: { status, assignee_id: assigneeId },
  });

  // Notify assignee if assigned
  if (assigneeId) {
    const { data: issueInfo } = await admin
      .from("issues")
      .select("title, units(name)")
      .eq("id", issueId)
      .single();

    const unitName = Array.isArray(issueInfo?.units)
      ? issueInfo.units[0]?.name
      : (issueInfo?.units as unknown as { name: string } | null)?.name;

    await notifyUser({
      userId: assigneeId,
      templateKey: "issue.assigned",
      message:
        `🔧 *Issue assigned to you:*\n\n` +
        `${unitName ? `🏠 ${unitName}\n` : ""}` +
        `📝 ${issueInfo?.title || "Issue"}\n` +
        `Status: ${status}`,
    });
  }

  revalidatePath("/dashboard/issues");
  return { success: true };
}

/** Add a comment to an issue. */
export async function addIssueComment(formData: FormData) {
  const auth = await requireAuth();

  const issueId = formData.get("issue_id") as string;
  const body = (formData.get("body") as string)?.trim();

  if (!issueId || !body) return { error: "Comment text is required." };

  const admin = createAdminClient();

  const { error } = await admin.from("issue_comments").insert({
    issue_id: issueId,
    author_id: auth.user.id,
    body,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/issues");
  return { success: true };
}
