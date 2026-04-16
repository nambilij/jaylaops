"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { notifyUser, notifyManagers } from "@/lib/telegram/notify";
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
    return { error: "Permission denied." };
  }

  return { user, profile, roleName };
}

/** Verify the current user is logged in and return their info. */
async function requireAuth() {
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

  return { user, profile, roleName };
}

/**
 * Generate daily tasks from active templates for a given date.
 * Idempotent — skips any template+unit+date combo that already exists.
 */
export async function generateDailyTasks(formData: FormData) {
  const auth = await requireSupervisor();
  if ("error" in auth) return auth;

  const date = (formData.get("date") as string) || new Date().toISOString().split("T")[0];
  const propertyId = auth.profile!.property_id;
  const admin = createAdminClient();

  // Get active daily templates for this property
  const { data: templates } = await admin
    .from("task_templates")
    .select("id, name, cadence")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .eq("cadence", "daily");

  if (!templates || templates.length === 0) {
    return { error: "No active daily templates found. Create templates first." };
  }

  // Get all active units
  const { data: units } = await admin
    .from("units")
    .select("id")
    .eq("property_id", propertyId)
    .eq("is_active", true);

  if (!units || units.length === 0) {
    return { error: "No active units found." };
  }

  // Check which tasks already exist for this date (idempotency)
  const { data: existing } = await admin
    .from("daily_tasks")
    .select("template_id, unit_id")
    .eq("property_id", propertyId)
    .eq("scheduled_for", date);

  const existingSet = new Set(
    (existing || []).map((e) => `${e.template_id}:${e.unit_id}`)
  );

  // Build new tasks — one per template per unit
  const newTasks = [];
  for (const template of templates) {
    for (const unit of units) {
      const key = `${template.id}:${unit.id}`;
      if (!existingSet.has(key)) {
        newTasks.push({
          property_id: propertyId,
          template_id: template.id,
          unit_id: unit.id,
          status: "PENDING",
          scheduled_for: date,
        });
      }
    }
  }

  if (newTasks.length === 0) {
    return { error: "All tasks for this date have already been generated." };
  }

  const { error } = await admin.from("daily_tasks").insert(newTasks);
  if (error) return { error: error.message };

  await logAudit({
    actor_id: auth.user.id,
    action: "tasks.generated",
    entity: "daily_tasks",
    diff: { date, templates_count: templates.length, units_count: units.length, tasks_created: newTasks.length },
  });

  revalidatePath("/dashboard/tasks");
  return { success: true, count: newTasks.length };
}

/** Assign a task to a housekeeper. */
export async function assignTask(formData: FormData) {
  const auth = await requireSupervisor();
  if ("error" in auth) return auth;

  const taskId = formData.get("task_id") as string;
  const assigneeId = formData.get("assignee_id") as string;

  if (!taskId || !assigneeId) {
    return { error: "Task and assignee are required." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("daily_tasks")
    .update({ assignee_id: assigneeId, status: "PENDING" })
    .eq("id", taskId)
    .eq("property_id", auth.profile!.property_id);

  if (error) return { error: error.message };

  // Record status history
  await admin.from("task_status_history").insert({
    task_id: taskId,
    actor_id: auth.user.id,
    from_status: "PENDING",
    to_status: "PENDING",
    reason: "Assigned to housekeeper",
  });

  await logAudit({
    actor_id: auth.user.id,
    action: "task.assigned",
    entity: "daily_tasks",
    entity_id: taskId,
    diff: { assignee_id: assigneeId },
  });

  // Notify the assignee via Telegram
  const { data: taskInfo } = await admin
    .from("daily_tasks")
    .select("units(name), task_templates(name)")
    .eq("id", taskId)
    .single();
  const unitName = Array.isArray(taskInfo?.units) ? taskInfo.units[0]?.name : (taskInfo?.units as unknown as { name: string } | null)?.name;
  const tmplName = Array.isArray(taskInfo?.task_templates) ? taskInfo.task_templates[0]?.name : (taskInfo?.task_templates as unknown as { name: string } | null)?.name;

  await notifyUser({
    userId: assigneeId,
    templateKey: "task.assigned",
    message: `📋 *New task assigned to you:*\n\n🏠 ${unitName || "Room"} — ${tmplName || "Task"}\n\nSend /start_task to begin.`,
  });

  revalidatePath("/dashboard/tasks");
  return { success: true };
}

/** Start a task (housekeeper clicks "Start"). */
export async function startTask(formData: FormData) {
  const auth = await requireAuth();
  const taskId = formData.get("task_id") as string;

  const admin = createAdminClient();

  // Verify task belongs to this user
  const { data: task } = await admin
    .from("daily_tasks")
    .select("id, status, assignee_id")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "Task not found." };

  const isManager = ["super_admin", "manager", "supervisor"].includes(auth.roleName || "");
  if (task.assignee_id !== auth.user.id && !isManager) {
    return { error: "This task is not assigned to you." };
  }

  if (task.status !== "PENDING" && task.status !== "REJECTED") {
    return { error: `Cannot start a task in ${task.status} status.` };
  }

  const { error } = await admin
    .from("daily_tasks")
    .update({ status: "IN_PROGRESS", started_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) return { error: error.message };

  await admin.from("task_status_history").insert({
    task_id: taskId,
    actor_id: auth.user.id,
    from_status: task.status,
    to_status: "IN_PROGRESS",
  });

  // Update room status
  await admin
    .from("units")
    .update({ status: "IN_PROGRESS" })
    .eq("id", (await admin.from("daily_tasks").select("unit_id").eq("id", taskId).single()).data!.unit_id);

  revalidatePath("/dashboard/tasks");
  return { success: true };
}

/** Complete a task (housekeeper finishes and submits). */
export async function completeTask(formData: FormData) {
  const auth = await requireAuth();
  const taskId = formData.get("task_id") as string;
  const checklistState = formData.get("checklist_state") as string;

  const admin = createAdminClient();

  const { data: task } = await admin
    .from("daily_tasks")
    .select("id, status, assignee_id, unit_id")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "Task not found." };

  const isManager = ["super_admin", "manager", "supervisor"].includes(auth.roleName || "");
  if (task.assignee_id !== auth.user.id && !isManager) {
    return { error: "This task is not assigned to you." };
  }

  if (task.status !== "IN_PROGRESS") {
    return { error: `Cannot complete a task in ${task.status} status.` };
  }

  const { error } = await admin
    .from("daily_tasks")
    .update({
      status: "AWAITING_INSPECTION",
      completed_at: new Date().toISOString(),
      checklist_state: checklistState ? JSON.parse(checklistState) : [],
    })
    .eq("id", taskId);

  if (error) return { error: error.message };

  await admin.from("task_status_history").insert({
    task_id: taskId,
    actor_id: auth.user.id,
    from_status: "IN_PROGRESS",
    to_status: "AWAITING_INSPECTION",
  });

  // Update room status
  await admin
    .from("units")
    .update({ status: "CLEANED" })
    .eq("id", task.unit_id);

  // Notify managers that a task is ready for inspection
  const { data: unitInfo } = await admin
    .from("units")
    .select("name, property_id")
    .eq("id", task.unit_id)
    .single();

  const { data: tmplInfo } = await admin
    .from("daily_tasks")
    .select("task_templates(name)")
    .eq("id", taskId)
    .single();
  const tmplName = Array.isArray(tmplInfo?.task_templates) ? tmplInfo.task_templates[0]?.name : (tmplInfo?.task_templates as unknown as { name: string } | null)?.name;

  const { data: assigneeInfo } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", auth.user.id)
    .single();

  if (unitInfo?.property_id) {
    await notifyManagers({
      propertyId: unitInfo.property_id,
      templateKey: "task.awaiting_inspection",
      message: `🔍 *Task ready for inspection:*\n\n🏠 ${unitInfo.name} — ${tmplName || "Task"}\nCompleted by: ${assigneeInfo?.full_name || "Staff"}\n\nCheck the dashboard or send /pending`,
    });
  }

  revalidatePath("/dashboard/tasks");
  return { success: true };
}

/** Save a photo reference for a task. */
export async function saveTaskPhoto(formData: FormData) {
  const auth = await requireAuth();
  const taskId = formData.get("task_id") as string;
  const storagePath = formData.get("storage_path") as string;

  if (!taskId || !storagePath) {
    return { error: "Task ID and storage path are required." };
  }

  const admin = createAdminClient();

  // Verify task exists and user is assignee or manager
  const { data: task } = await admin
    .from("daily_tasks")
    .select("id, assignee_id")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "Task not found." };

  const isManager = ["super_admin", "manager", "supervisor"].includes(auth.roleName || "");
  if (task.assignee_id !== auth.user.id && !isManager) {
    return { error: "You cannot upload photos for this task." };
  }

  const { error } = await admin.from("task_photos").insert({
    task_id: taskId,
    storage_path: storagePath,
    file_name: storagePath.split("/").pop(),
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tasks");
  return { success: true };
}

/** Inspect a task — approve or reject. */
export async function inspectTask(formData: FormData) {
  const auth = await requireSupervisor();
  if ("error" in auth) return auth;

  const taskId = formData.get("task_id") as string;
  const result = formData.get("result") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const score = parseInt(formData.get("score") as string) || null;

  if (!taskId || !result) {
    return { error: "Task and result are required." };
  }

  if (result !== "approved" && result !== "rejected") {
    return { error: "Result must be approved or rejected." };
  }

  const admin = createAdminClient();

  const { data: task } = await admin
    .from("daily_tasks")
    .select("id, status, unit_id")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "Task not found." };
  if (task.status !== "AWAITING_INSPECTION") {
    return { error: `Cannot inspect a task in ${task.status} status.` };
  }

  const newStatus = result === "approved" ? "APPROVED" : "REJECTED";

  const { error: taskError } = await admin
    .from("daily_tasks")
    .update({
      status: newStatus,
      inspected_at: new Date().toISOString(),
      inspector_id: auth.user.id,
      rejection_reason: result === "rejected" ? notes : null,
    })
    .eq("id", taskId);

  if (taskError) return { error: taskError.message };

  // Create inspection record
  await admin.from("inspections").insert({
    task_id: taskId,
    inspector_id: auth.user.id,
    result,
    notes,
    score,
  });

  // Record status history
  await admin.from("task_status_history").insert({
    task_id: taskId,
    actor_id: auth.user.id,
    from_status: "AWAITING_INSPECTION",
    to_status: newStatus,
    reason: notes,
  });

  // Update room status
  if (result === "approved") {
    await admin
      .from("units")
      .update({ status: "INSPECTED" })
      .eq("id", task.unit_id);
  } else {
    // Rejected — room goes back to dirty
    await admin
      .from("units")
      .update({ status: "DIRTY" })
      .eq("id", task.unit_id);
  }

  await logAudit({
    actor_id: auth.user.id,
    action: `task.${result}`,
    entity: "daily_tasks",
    entity_id: taskId,
    diff: { result, notes, score },
  });

  // Notify the assignee about the inspection result
  const { data: fullTask } = await admin
    .from("daily_tasks")
    .select("assignee_id, units(name), task_templates(name)")
    .eq("id", taskId)
    .single();

  if (fullTask?.assignee_id) {
    const unitName = Array.isArray(fullTask.units) ? fullTask.units[0]?.name : (fullTask.units as unknown as { name: string } | null)?.name;
    const tmplName = Array.isArray(fullTask.task_templates) ? fullTask.task_templates[0]?.name : (fullTask.task_templates as unknown as { name: string } | null)?.name;

    if (result === "approved") {
      await notifyUser({
        userId: fullTask.assignee_id,
        templateKey: "task.approved",
        message: `✅ *Task approved!*\n\n🏠 ${unitName || "Room"} — ${tmplName || "Task"}\n${score ? `Score: ${"⭐".repeat(score)}` : ""}\n\nGreat work!`,
      });
    } else {
      await notifyUser({
        userId: fullTask.assignee_id,
        templateKey: "task.rejected",
        message: `❌ *Task rejected:*\n\n🏠 ${unitName || "Room"} — ${tmplName || "Task"}\nReason: ${notes || "No reason given"}\n\nSend /start_task to redo it.`,
      });
    }
  }

  revalidatePath("/dashboard/tasks");
  return { success: true };
}
