import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { FeedbackForm } from "./feedback-form";

export default async function GuestFeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  // Look up unit by QR token — public page, no auth needed
  const { data: unit } = await admin
    .from("units")
    .select("id, name, short_code, qr_token, properties(name)")
    .eq("qr_token", token)
    .eq("is_active", true)
    .single();

  if (!unit) {
    notFound();
  }

  const propertyName = Array.isArray(unit.properties)
    ? unit.properties[0]?.name
    : (unit.properties as unknown as { name: string } | null)?.name;

  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {propertyName || "Guest Feedback"}
          </h1>
          <p className="mt-2 text-lg text-gray-600">{unit.name}</p>
          <p className="mt-1 text-sm text-gray-400">
            We&apos;d love to hear about your stay
          </p>
        </div>

        <FeedbackForm qrToken={token} unitName={unit.name} />
      </div>
    </div>
  );
}
