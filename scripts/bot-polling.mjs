/**
 * Run the Telegram bot in polling mode for local development.
 * Usage: node scripts/bot-polling.mjs
 *
 * This checks Telegram for new messages every few seconds.
 * No ngrok or public URL needed.
 */

import { Bot } from "grammy";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!token || !supabaseUrl || !supabaseServiceKey) {
  console.error("Missing env vars. Make sure .env.local has TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function createAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function logAudit({ actor_id, action, entity, entity_id, diff }) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({ actor_id, action, entity, entity_id, diff: diff || {} });
}

// ============================================================
// Helper: look up staff by Telegram user ID
// ============================================================
async function getStaffByTgId(tgUserId) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, email, property_id, role_id, is_active, roles(name)")
    .eq("tg_user_id", tgUserId)
    .single();

  if (!data) return null;
  const rolesData = data.roles;
  const roleName = Array.isArray(rolesData) ? rolesData[0]?.name : rolesData?.name;
  return { ...data, roleName };
}

const bot = new Bot(token);

// /start
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

// /help
bot.command("help", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from.id);
  if (!staff) {
    await ctx.reply("You haven't linked your account yet. Use /link <code> to connect.");
    return;
  }
  const isManager = ["super_admin", "manager", "supervisor"].includes(staff.roleName || "");
  let msg = "📋 Available Commands:\n\n";
  msg += "/today — Today's tasks\n";
  msg += "/next — Your next pending task\n";
  msg += "/start_task — Start your next pending task\n";
  msg += "/done — Mark current task as complete\n";
  if (isManager) {
    msg += "\nManager commands:\n";
    msg += "/all_tasks — All tasks for today\n";
    msg += "/pending — Tasks waiting for inspection\n";
  }
  await ctx.reply(msg);
});

// /link <code>
bot.command("link", async (ctx) => {
  const code = ctx.match?.trim();
  if (!code || code.length !== 6) {
    await ctx.reply("Usage: /link 123456\n\nAsk your manager for your 6-digit link code.");
    return;
  }
  const admin = createAdminClient();
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

  const { error } = await admin
    .from("profiles")
    .update({ tg_user_id: ctx.from.id, tg_link_code: null, tg_link_expires: null })
    .eq("id", profile.id);

  if (error) {
    await ctx.reply("Something went wrong. Please try again.");
    return;
  }

  await logAudit({ actor_id: profile.id, action: "telegram.linked", entity: "profiles", entity_id: profile.id, diff: { tg_user_id: ctx.from.id } });
  await ctx.reply(`✅ Account linked! Welcome, ${profile.full_name || "team member"}.\n\nSend /today to see your tasks.`);
});

// /today
bot.command("today", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from.id);
  if (!staff) { await ctx.reply("Link your account first with /link <code>"); return; }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const isManager = ["super_admin", "manager", "supervisor"].includes(staff.roleName || "");

  let query = admin
    .from("daily_tasks")
    .select("id, status, units(name, short_code), task_templates(name)")
    .eq("property_id", staff.property_id)
    .eq("scheduled_for", today)
    .order("status");

  if (!isManager) query = query.eq("assignee_id", staff.id);
  const { data: tasks } = await query;

  if (!tasks || tasks.length === 0) { await ctx.reply("No tasks for today. 🎉"); return; }

  let msg = `📋 Today's Tasks (${today}):\n\n`;
  for (const task of tasks) {
    const unit = Array.isArray(task.units) ? task.units[0] : task.units;
    const template = Array.isArray(task.task_templates) ? task.task_templates[0] : task.task_templates;
    const icon = task.status === "APPROVED" ? "✅" : task.status === "IN_PROGRESS" ? "🔄" : task.status === "AWAITING_INSPECTION" ? "🔍" : task.status === "REJECTED" ? "❌" : task.status === "PENDING" ? "⏳" : "⬜";
    msg += `${icon} ${unit?.name || "?"} — ${template?.name || "Task"}\n   Status: ${task.status.replace(/_/g, " ")}\n\n`;
  }
  await ctx.reply(msg);
});

// /next
bot.command("next", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from.id);
  if (!staff) { await ctx.reply("Link your account first with /link <code>"); return; }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: task } = await admin
    .from("daily_tasks")
    .select("id, status, units(name), task_templates(name, estimated_minutes)")
    .eq("assignee_id", staff.id).eq("scheduled_for", today).in("status", ["PENDING", "REJECTED"]).limit(1).single();

  if (!task) {
    const { data: inProgress } = await admin.from("daily_tasks").select("id, units(name), task_templates(name)")
      .eq("assignee_id", staff.id).eq("scheduled_for", today).eq("status", "IN_PROGRESS").limit(1).single();
    if (inProgress) {
      const u = Array.isArray(inProgress.units) ? inProgress.units[0] : inProgress.units;
      const t = Array.isArray(inProgress.task_templates) ? inProgress.task_templates[0] : inProgress.task_templates;
      await ctx.reply(`🔄 You have a task in progress:\n${u?.name} — ${t?.name}\n\nFinish it first, then send /done`);
    } else { await ctx.reply("No pending tasks! You're all caught up. 🎉"); }
    return;
  }

  const unit = Array.isArray(task.units) ? task.units[0] : task.units;
  const template = Array.isArray(task.task_templates) ? task.task_templates[0] : task.task_templates;
  await ctx.reply(`⏳ Next task:\n\n🏠 ${unit?.name || "?"}\n📝 ${template?.name || "Task"}\n⏱ ~${template?.estimated_minutes || "?"} min\n\nSend /start_task to begin.`);
});

// /start_task
bot.command("start_task", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from.id);
  if (!staff) { await ctx.reply("Link your account first with /link <code>"); return; }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: task } = await admin.from("daily_tasks")
    .select("id, status, unit_id, units(name), task_templates(name)")
    .eq("assignee_id", staff.id).eq("scheduled_for", today).in("status", ["PENDING", "REJECTED"]).limit(1).single();

  if (!task) { await ctx.reply("No pending tasks to start. Send /today to see your tasks."); return; }

  await admin.from("daily_tasks").update({ status: "IN_PROGRESS", started_at: new Date().toISOString() }).eq("id", task.id);
  await admin.from("task_status_history").insert({ task_id: task.id, actor_id: staff.id, from_status: task.status, to_status: "IN_PROGRESS" });
  await admin.from("units").update({ status: "IN_PROGRESS" }).eq("id", task.unit_id);

  const unit = Array.isArray(task.units) ? task.units[0] : task.units;
  const tmpl = Array.isArray(task.task_templates) ? task.task_templates[0] : task.task_templates;
  await ctx.reply(`🔄 Task started!\n\n🏠 ${unit?.name || "?"} — ${tmpl?.name || "Task"}\n\nWhen you're done, send /done`);
});

// /done
bot.command("done", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from.id);
  if (!staff) { await ctx.reply("Link your account first with /link <code>"); return; }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: task } = await admin.from("daily_tasks")
    .select("id, unit_id, units(name), task_templates(name)")
    .eq("assignee_id", staff.id).eq("scheduled_for", today).eq("status", "IN_PROGRESS").limit(1).single();

  if (!task) { await ctx.reply("No task in progress. Send /start_task to begin one."); return; }

  await admin.from("daily_tasks").update({ status: "AWAITING_INSPECTION", completed_at: new Date().toISOString() }).eq("id", task.id);
  await admin.from("task_status_history").insert({ task_id: task.id, actor_id: staff.id, from_status: "IN_PROGRESS", to_status: "AWAITING_INSPECTION" });
  await admin.from("units").update({ status: "CLEANED" }).eq("id", task.unit_id);

  const unit = Array.isArray(task.units) ? task.units[0] : task.units;
  const tmpl = Array.isArray(task.task_templates) ? task.task_templates[0] : task.task_templates;
  await ctx.reply(`✅ Task complete!\n\n🏠 ${unit?.name || "?"} — ${tmpl?.name || "Task"}\n\nWaiting for inspection. Send /next for your next task.`);
});

// /pending
bot.command("pending", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from.id);
  if (!staff) { await ctx.reply("Link your account first with /link <code>"); return; }
  if (!["super_admin", "manager", "supervisor"].includes(staff.roleName || "")) {
    await ctx.reply("This command is for managers and supervisors only."); return;
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: tasks } = await admin.from("daily_tasks")
    .select("id, units(name), task_templates(name), assignee_id")
    .eq("property_id", staff.property_id).eq("scheduled_for", today).eq("status", "AWAITING_INSPECTION");

  if (!tasks || tasks.length === 0) { await ctx.reply("No tasks waiting for inspection. 👍"); return; }

  const assigneeIds = [...new Set(tasks.map(t => t.assignee_id).filter(Boolean))];
  const { data: assignees } = assigneeIds.length ? await admin.from("profiles").select("id, full_name").in("id", assigneeIds) : { data: [] };
  const nameMap = new Map((assignees || []).map(a => [a.id, a.full_name || "?"]));

  let msg = `🔍 Tasks Awaiting Inspection (${tasks.length}):\n\n`;
  for (const task of tasks) {
    const unit = Array.isArray(task.units) ? task.units[0] : task.units;
    const tmpl = Array.isArray(task.task_templates) ? task.task_templates[0] : task.task_templates;
    msg += `🏠 ${unit?.name} — ${tmpl?.name}\n   By: ${nameMap.get(task.assignee_id) || "?"}\n\n`;
  }
  msg += "Use the web dashboard to approve/reject.";
  await ctx.reply(msg);
});

// /all_tasks
bot.command("all_tasks", async (ctx) => {
  const staff = await getStaffByTgId(ctx.from.id);
  if (!staff) { await ctx.reply("Link your account first with /link <code>"); return; }
  if (!["super_admin", "manager", "supervisor"].includes(staff.roleName || "")) {
    await ctx.reply("This command is for managers and supervisors only."); return;
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const { data: tasks } = await admin.from("daily_tasks").select("status").eq("property_id", staff.property_id).eq("scheduled_for", today);

  if (!tasks || tasks.length === 0) { await ctx.reply("No tasks for today."); return; }

  const counts = {};
  tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });

  let msg = `📊 Today's Task Summary:\n\nTotal: ${tasks.length}\n\n`;
  for (const [status, count] of Object.entries(counts)) {
    const icon = status === "APPROVED" ? "✅" : status === "IN_PROGRESS" ? "🔄" : status === "AWAITING_INSPECTION" ? "🔍" : status === "REJECTED" ? "❌" : status === "PENDING" ? "⏳" : "⬜";
    msg += `${icon} ${status.replace(/_/g, " ")}: ${count}\n`;
  }
  await ctx.reply(msg);
});

// Set bot commands menu
bot.api.setMyCommands([
  { command: "start", description: "Welcome message" },
  { command: "link", description: "Link your account: /link 123456" },
  { command: "today", description: "See today's tasks" },
  { command: "next", description: "Your next pending task" },
  { command: "start_task", description: "Start your next task" },
  { command: "done", description: "Mark current task as complete" },
  { command: "pending", description: "Tasks awaiting inspection" },
  { command: "all_tasks", description: "Today's task summary" },
  { command: "help", description: "List all commands" },
]);

// Start polling
console.log("🤖 JaylaOps bot starting in polling mode...");
bot.start({
  onStart: () => console.log("✅ Bot is running! Send /start to your bot in Telegram."),
});
