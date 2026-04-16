import { Bot } from "grammy";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// Create bot instance (reused across requests)
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

// ============================================================
// Helper: look up a staff profile by their Telegram user ID
// ============================================================
async function getStaffByTgId(tgUserId: number) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, email, property_id, role_id, is_active, roles(name)")
    .eq("tg_user_id", tgUserId)
    .single();

  if (!data) return null;

  const rolesData = data.roles;
  const roleName = Array.isArray(rolesData)
    ? rolesData[0]?.name
    : (rolesData as unknown as { name: string } | null)?.name;

  return { ...data, roleName };
}

// ============================================================
// /start — welcome message
// ============================================================
bot.command("start", async (ctx) => {
  await ctx.reply(
    "Welcome to JaylaOps! 🏠\n\n" +
      "If you're a staff member, ask your manager for a 6-digit link code, then send:\n" +
      "/link 123456\n\n" +
      "Once linked, you can use:\n" +
      "/today — See today's tasks\n" +
      "/next — See your next task\n" +
      "/start_task — Start your next pending task\n" +
      "/done — Mark current task as complete\n" +
      "/help — See all commands"
  );
});

// ============================================================
// /help — list available commands
// ============================================================
bot.command("help", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from!.id);
  if (!staff) {
    await ctx.reply("You haven't linked your account yet. Use /link <code> to connect.");
    return;
  }

  const isManager = ["super_admin", "manager", "supervisor"].includes(staff.roleName || "");

  let msg = "📋 *Available Commands:*\n\n";
  msg += "/today — Today's tasks\n";
  msg += "/next — Your next pending task\n";
  msg += "/start\\_task — Start your next pending task\n";
  msg += "/done — Mark current task as complete\n";

  if (isManager) {
    msg += "\n*Manager commands:*\n";
    msg += "/all\\_tasks — All tasks for today\n";
    msg += "/pending — Tasks waiting for inspection\n";
  }

  await ctx.reply(msg, { parse_mode: "Markdown" });
});

// ============================================================
// /link <code> — link Telegram account to staff profile
// ============================================================
bot.command("link", async (ctx) => {
  const code = ctx.match?.trim();
  if (!code || code.length !== 6) {
    await ctx.reply("Usage: /link 123456\n\nAsk your manager for your 6-digit link code.");
    return;
  }

  const admin = createAdminClient();

  // Find a profile with this link code that hasn't expired
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, tg_link_code, tg_link_expires")
    .eq("tg_link_code", code)
    .gt("tg_link_expires", new Date().toISOString())
    .is("tg_user_id", null)
    .single();

  if (!profile) {
    await ctx.reply("Invalid or expired code. Ask your manager for a new one.");
    return;
  }

  // Link the Telegram account
  const { error } = await admin
    .from("profiles")
    .update({
      tg_user_id: ctx.from!.id,
      tg_link_code: null,
      tg_link_expires: null,
    })
    .eq("id", profile.id);

  if (error) {
    await ctx.reply("Something went wrong. Please try again or contact your manager.");
    return;
  }

  await logAudit({
    actor_id: profile.id,
    action: "telegram.linked",
    entity: "profiles",
    entity_id: profile.id,
    diff: { tg_user_id: ctx.from!.id },
  });

  await ctx.reply(
    `✅ Account linked! Welcome, ${profile.full_name || "team member"}.\n\n` +
      "Send /today to see your tasks."
  );
});

// ============================================================
// /today — show today's tasks for this user
// ============================================================
bot.command("today", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from!.id);
  if (!staff) {
    await ctx.reply("Link your account first with /link <code>");
    return;
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const isManager = ["super_admin", "manager", "supervisor"].includes(staff.roleName || "");

  // Housekeepers see only their tasks; managers see all
  let query = admin
    .from("daily_tasks")
    .select("id, status, units(name, short_code), task_templates(name)")
    .eq("property_id", staff.property_id)
    .eq("scheduled_for", today)
    .order("status");

  if (!isManager) {
    query = query.eq("assignee_id", staff.id);
  }

  const { data: tasks } = await query;

  if (!tasks || tasks.length === 0) {
    await ctx.reply("No tasks for today. 🎉");
    return;
  }

  let msg = `📋 *Today's Tasks (${today}):*\n\n`;
  for (const task of tasks) {
    const unit = Array.isArray(task.units) ? task.units[0] : task.units;
    const template = Array.isArray(task.task_templates) ? task.task_templates[0] : task.task_templates;
    const statusIcon =
      task.status === "APPROVED" ? "✅" :
      task.status === "IN_PROGRESS" ? "🔄" :
      task.status === "AWAITING_INSPECTION" ? "🔍" :
      task.status === "REJECTED" ? "❌" :
      task.status === "PENDING" ? "⏳" : "⬜";

    msg += `${statusIcon} *${(unit as { name: string } | null)?.name || "?"}* — ${(template as { name: string } | null)?.name || "Task"}\n`;
    msg += `   Status: ${task.status.replace(/_/g, " ")}\n\n`;
  }

  await ctx.reply(msg, { parse_mode: "Markdown" });
});

// ============================================================
// /next — show the user's next pending task
// ============================================================
bot.command("next", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from!.id);
  if (!staff) {
    await ctx.reply("Link your account first with /link <code>");
    return;
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: task } = await admin
    .from("daily_tasks")
    .select("id, status, units(name, short_code), task_templates(name, estimated_minutes)")
    .eq("assignee_id", staff.id)
    .eq("scheduled_for", today)
    .in("status", ["PENDING", "REJECTED"])
    .limit(1)
    .single();

  if (!task) {
    // Check for in-progress task
    const { data: inProgress } = await admin
      .from("daily_tasks")
      .select("id, units(name), task_templates(name)")
      .eq("assignee_id", staff.id)
      .eq("scheduled_for", today)
      .eq("status", "IN_PROGRESS")
      .limit(1)
      .single();

    if (inProgress) {
      const unit = Array.isArray(inProgress.units) ? inProgress.units[0] : inProgress.units;
      const tmpl = Array.isArray(inProgress.task_templates) ? inProgress.task_templates[0] : inProgress.task_templates;
      await ctx.reply(
        `🔄 You have a task in progress:\n*${(unit as { name: string } | null)?.name}* — ${(tmpl as { name: string } | null)?.name}\n\nFinish it first, then send /done`,
        { parse_mode: "Markdown" }
      );
    } else {
      await ctx.reply("No pending tasks! You're all caught up. 🎉");
    }
    return;
  }

  const unit = Array.isArray(task.units) ? task.units[0] : task.units;
  const template = Array.isArray(task.task_templates) ? task.task_templates[0] : task.task_templates;

  await ctx.reply(
    `⏳ *Next task:*\n\n` +
      `🏠 *${(unit as { name: string } | null)?.name || "?"}*\n` +
      `📝 ${(template as { name: string } | null)?.name || "Task"}\n` +
      `⏱ ~${(template as { estimated_minutes: number } | null)?.estimated_minutes || "?"} min\n\n` +
      `Send /start_task to begin.`,
    { parse_mode: "Markdown" }
  );
});

// ============================================================
// /start_task — start the next pending task
// ============================================================
bot.command("start_task", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from!.id);
  if (!staff) {
    await ctx.reply("Link your account first with /link <code>");
    return;
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Find next pending task
  const { data: task } = await admin
    .from("daily_tasks")
    .select("id, status, unit_id, units(name), task_templates(name)")
    .eq("assignee_id", staff.id)
    .eq("scheduled_for", today)
    .in("status", ["PENDING", "REJECTED"])
    .limit(1)
    .single();

  if (!task) {
    await ctx.reply("No pending tasks to start. Send /today to see your tasks.");
    return;
  }

  // Update task status
  const { error } = await admin
    .from("daily_tasks")
    .update({ status: "IN_PROGRESS", started_at: new Date().toISOString() })
    .eq("id", task.id);

  if (error) {
    await ctx.reply("Something went wrong. Try again.");
    return;
  }

  // Record history
  await admin.from("task_status_history").insert({
    task_id: task.id,
    actor_id: staff.id,
    from_status: task.status,
    to_status: "IN_PROGRESS",
  });

  // Update room status
  await admin
    .from("units")
    .update({ status: "IN_PROGRESS" })
    .eq("id", task.unit_id);

  const unit = Array.isArray(task.units) ? task.units[0] : task.units;
  const tmpl = Array.isArray(task.task_templates) ? task.task_templates[0] : task.task_templates;

  await ctx.reply(
    `🔄 *Task started!*\n\n` +
      `🏠 ${(unit as { name: string } | null)?.name || "?"} — ${(tmpl as { name: string } | null)?.name || "Task"}\n\n` +
      `When you're done, send /done`,
    { parse_mode: "Markdown" }
  );
});

// ============================================================
// /done — complete the current in-progress task
// ============================================================
bot.command("done", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from!.id);
  if (!staff) {
    await ctx.reply("Link your account first with /link <code>");
    return;
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Find in-progress task
  const { data: task } = await admin
    .from("daily_tasks")
    .select("id, unit_id, units(name), task_templates(name)")
    .eq("assignee_id", staff.id)
    .eq("scheduled_for", today)
    .eq("status", "IN_PROGRESS")
    .limit(1)
    .single();

  if (!task) {
    await ctx.reply("No task in progress. Send /start_task to begin one.");
    return;
  }

  // Update task
  const { error } = await admin
    .from("daily_tasks")
    .update({
      status: "AWAITING_INSPECTION",
      completed_at: new Date().toISOString(),
    })
    .eq("id", task.id);

  if (error) {
    await ctx.reply("Something went wrong. Try again.");
    return;
  }

  // Record history
  await admin.from("task_status_history").insert({
    task_id: task.id,
    actor_id: staff.id,
    from_status: "IN_PROGRESS",
    to_status: "AWAITING_INSPECTION",
  });

  // Update room status
  await admin
    .from("units")
    .update({ status: "CLEANED" })
    .eq("id", task.unit_id);

  const unit = Array.isArray(task.units) ? task.units[0] : task.units;
  const tmpl = Array.isArray(task.task_templates) ? task.task_templates[0] : task.task_templates;

  await ctx.reply(
    `✅ *Task complete!*\n\n` +
      `🏠 ${(unit as { name: string } | null)?.name || "?"} — ${(tmpl as { name: string } | null)?.name || "Task"}\n\n` +
      `Waiting for inspection. Send /next for your next task.`,
    { parse_mode: "Markdown" }
  );
});

// ============================================================
// /pending — show tasks awaiting inspection (managers only)
// ============================================================
bot.command("pending", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from!.id);
  if (!staff) {
    await ctx.reply("Link your account first with /link <code>");
    return;
  }

  const isManager = ["super_admin", "manager", "supervisor"].includes(staff.roleName || "");
  if (!isManager) {
    await ctx.reply("This command is for managers and supervisors only.");
    return;
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: tasks } = await admin
    .from("daily_tasks")
    .select("id, units(name, short_code), task_templates(name), assignee_id")
    .eq("property_id", staff.property_id)
    .eq("scheduled_for", today)
    .eq("status", "AWAITING_INSPECTION");

  if (!tasks || tasks.length === 0) {
    await ctx.reply("No tasks waiting for inspection. 👍");
    return;
  }

  // Get assignee names
  const assigneeIds = [...new Set(tasks.map((t) => t.assignee_id).filter(Boolean))];
  const { data: assignees } = assigneeIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", assigneeIds)
    : { data: [] };
  const nameMap = new Map((assignees || []).map((a) => [a.id, a.full_name || "?"]));

  let msg = `🔍 *Tasks Awaiting Inspection (${tasks.length}):*\n\n`;
  for (const task of tasks) {
    const unit = Array.isArray(task.units) ? task.units[0] : task.units;
    const tmpl = Array.isArray(task.task_templates) ? task.task_templates[0] : task.task_templates;
    msg += `🏠 *${(unit as { name: string } | null)?.name}* — ${(tmpl as { name: string } | null)?.name}\n`;
    msg += `   By: ${nameMap.get(task.assignee_id!) || "?"}\n\n`;
  }

  msg += "Use the web dashboard to inspect and approve/reject.";

  await ctx.reply(msg, { parse_mode: "Markdown" });
});

// ============================================================
// /all_tasks — show all tasks for today (managers only)
// ============================================================
bot.command("all_tasks", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from!.id);
  if (!staff) {
    await ctx.reply("Link your account first with /link <code>");
    return;
  }

  const isManager = ["super_admin", "manager", "supervisor"].includes(staff.roleName || "");
  if (!isManager) {
    await ctx.reply("This command is for managers and supervisors only.");
    return;
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: tasks } = await admin
    .from("daily_tasks")
    .select("status")
    .eq("property_id", staff.property_id)
    .eq("scheduled_for", today);

  if (!tasks || tasks.length === 0) {
    await ctx.reply("No tasks for today.");
    return;
  }

  const counts: Record<string, number> = {};
  tasks.forEach((t) => {
    counts[t.status] = (counts[t.status] || 0) + 1;
  });

  let msg = `📊 *Today's Task Summary:*\n\n`;
  msg += `Total: ${tasks.length}\n\n`;
  for (const [status, count] of Object.entries(counts)) {
    const icon =
      status === "APPROVED" ? "✅" :
      status === "IN_PROGRESS" ? "🔄" :
      status === "AWAITING_INSPECTION" ? "🔍" :
      status === "REJECTED" ? "❌" :
      status === "PENDING" ? "⏳" : "⬜";
    msg += `${icon} ${status.replace(/_/g, " ")}: ${count}\n`;
  }

  await ctx.reply(msg, { parse_mode: "Markdown" });
});

export { bot };
