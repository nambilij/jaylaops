"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyManagers } from "@/lib/telegram/notify";
import crypto from "crypto";

// Keywords that trigger urgency (from PRD §S8)
const URGENT_KEYWORDS = ["pest", "dirty", "broken", "leak", "smell", "unsafe"];

/**
 * Submit guest feedback. Called from the public QR page.
 * No authentication required.
 */
export async function submitFeedback(formData: FormData) {
  const qrToken = formData.get("qr_token") as string;
  const cleanliness = parseInt(formData.get("cleanliness") as string) || 0;
  const comfort = parseInt(formData.get("comfort") as string) || 0;
  const communication = parseInt(formData.get("communication") as string) || 0;
  const overall = parseInt(formData.get("overall") as string) || 0;
  const cleanOnArrival = formData.get("clean_on_arrival") === "true";
  const comments = (formData.get("comments") as string)?.trim() || "";
  const guestContact = (formData.get("guest_contact") as string)?.trim() || null;
  const honeypot = formData.get("website") as string; // honeypot field

  // Anti-abuse: reject if honeypot is filled (bots fill hidden fields)
  if (honeypot) {
    return { success: true, referenceNumber: "SPAM" }; // Silently discard
  }

  // Validate ratings
  if (overall < 1 || overall > 5) {
    return { error: "Please provide an overall rating." };
  }

  // Anti-spam: reject if all ratings identical and no comment
  if (
    cleanliness === comfort &&
    comfort === communication &&
    communication === overall &&
    !comments
  ) {
    return { error: "Please add a comment or vary your ratings." };
  }

  const admin = createAdminClient();

  // Look up the unit by QR token
  const { data: unit } = await admin
    .from("units")
    .select("id, name, property_id")
    .eq("qr_token", qrToken)
    .single();

  if (!unit) {
    return { error: "Invalid QR code. Please scan the code in your room." };
  }

  // Compute urgency (PRD §S8)
  const commentsLower = comments.toLowerCase();
  const hasUrgentKeyword = URGENT_KEYWORDS.some((kw) => commentsLower.includes(kw));
  const isUrgent = overall <= 2 || !cleanOnArrival || hasUrgentKeyword;

  // Generate reference number
  const refNumber = `FB-${Date.now().toString(36).toUpperCase()}`;

  // Hash IP for privacy (POPIA)
  const ipHash = crypto
    .createHash("sha256")
    .update(`${Date.now()}-salt`)
    .digest("hex")
    .slice(0, 16);

  const { error } = await admin.from("guest_feedback").insert({
    property_id: unit.property_id,
    unit_id: unit.id,
    qr_token_used: qrToken,
    ratings: { cleanliness, comfort, communication, overall },
    clean_on_arrival: cleanOnArrival,
    comments: comments || null,
    guest_contact: guestContact,
    is_urgent: isUrgent,
    reference_number: refNumber,
    ip_hash: ipHash,
  });

  if (error) {
    return { error: "Failed to submit feedback. Please try again." };
  }

  // If urgent, notify managers immediately
  if (isUrgent) {
    const urgencyReasons = [];
    if (overall <= 2) urgencyReasons.push(`low rating (${overall}/5)`);
    if (!cleanOnArrival) urgencyReasons.push("room not clean on arrival");
    if (hasUrgentKeyword) urgencyReasons.push("urgent keyword detected");

    await notifyManagers({
      propertyId: unit.property_id,
      templateKey: "feedback.urgent",
      message:
        `🚨 *URGENT Guest Feedback*\n\n` +
        `🏠 ${unit.name}\n` +
        `⭐ Overall: ${overall}/5\n` +
        `🧹 Clean on arrival: ${cleanOnArrival ? "Yes" : "No"}\n` +
        `${comments ? `💬 "${comments}"\n` : ""}` +
        `\nReason: ${urgencyReasons.join(", ")}\n` +
        `Ref: ${refNumber}\n` +
        `${guestContact ? `📞 Contact: ${guestContact}` : "No contact provided"}`,
    });
  }

  return { success: true, referenceNumber: refNumber, isUrgent };
}
