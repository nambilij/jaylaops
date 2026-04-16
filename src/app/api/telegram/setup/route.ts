import { NextRequest, NextResponse } from "next/server";

/**
 * Call this endpoint once to register the webhook with Telegram.
 * GET /api/telegram/setup?url=https://your-domain.com/api/telegram
 *
 * For local development, use ngrok to expose localhost:
 *   ngrok http 3000
 * Then call: /api/telegram/setup?url=https://xxxx.ngrok.io/api/telegram
 */
export async function GET(req: NextRequest) {
  const webhookUrl = req.nextUrl.searchParams.get("url");

  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Pass ?url=https://your-domain.com/api/telegram" },
      { status: 400 }
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  // Tell Telegram to send updates to our webhook URL
  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    }
  );

  const data = await res.json();

  // Also set the bot's commands menu
  await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "start", description: "Welcome message" },
        { command: "link", description: "Link your account: /link 123456" },
        { command: "today", description: "See today's tasks" },
        { command: "next", description: "Your next pending task" },
        { command: "start_task", description: "Start your next task" },
        { command: "done", description: "Mark current task as complete" },
        { command: "pending", description: "Tasks awaiting inspection" },
        { command: "all_tasks", description: "Today's task summary" },
        { command: "help", description: "List all commands" },
      ],
    }),
  });

  return NextResponse.json({ webhook: data });
}
