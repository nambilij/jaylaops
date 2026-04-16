import { NextRequest, NextResponse } from "next/server";
import { bot } from "@/lib/telegram/bot";
import { webhookCallback } from "grammy";

// grammY's webhook handler adapted for Next.js App Router
const handleUpdate = webhookCallback(bot, "std/http");

export async function POST(req: NextRequest) {
  try {
    return await handleUpdate(req);
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}

// Telegram sends GET to verify the webhook is alive
export async function GET() {
  return NextResponse.json({ status: "ok", bot: "jaylaops" });
}
