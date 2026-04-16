import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function FeedbackPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("roles(name)")
    .eq("id", user.id)
    .single();

  const rolesData = profile?.roles;
  const roleName = Array.isArray(rolesData)
    ? rolesData[0]?.name
    : (rolesData as unknown as { name: string } | null)?.name;

  if (!["super_admin", "manager", "supervisor"].includes(roleName || "")) {
    redirect("/dashboard");
  }

  // Get recent feedback
  const { data: feedback } = await supabase
    .from("guest_feedback")
    .select("id, ratings, clean_on_arrival, comments, guest_contact, is_urgent, reference_number, submitted_at, units(name, short_code)")
    .order("submitted_at", { ascending: false })
    .limit(50);

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
          Guest Feedback
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Responses from guests who scanned the room QR codes.
        </p>

        {!feedback || feedback.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No feedback yet. Guests will submit feedback by scanning QR codes in
            their rooms.
          </div>
        ) : (
          <div className="space-y-4">
            {feedback.map((fb) => {
              const unit = Array.isArray(fb.units) ? fb.units[0] : fb.units;
              const ratings = fb.ratings as {
                cleanliness?: number;
                comfort?: number;
                communication?: number;
                overall?: number;
              };

              return (
                <div
                  key={fb.id}
                  className={`rounded-lg border bg-white p-5 ${
                    fb.is_urgent
                      ? "border-red-300 bg-red-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {(unit as { name: string } | null)?.name || "Unknown room"}
                        {fb.is_urgent && (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            URGENT
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(fb.submitted_at).toLocaleString("en-ZA")} —
                        Ref: {fb.reference_number}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl">
                        {"⭐".repeat(ratings.overall || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Ratings breakdown */}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>Cleanliness: {ratings.cleanliness || "—"}/5</span>
                    <span>Comfort: {ratings.comfort || "—"}/5</span>
                    <span>Communication: {ratings.communication || "—"}/5</span>
                    <span>
                      Clean on arrival:{" "}
                      {fb.clean_on_arrival === null
                        ? "—"
                        : fb.clean_on_arrival
                          ? "Yes"
                          : "No"}
                    </span>
                  </div>

                  {fb.comments && (
                    <p className="mt-3 text-sm text-gray-700">
                      &quot;{fb.comments}&quot;
                    </p>
                  )}

                  {fb.guest_contact && (
                    <p className="mt-2 text-xs text-gray-500">
                      Contact: {fb.guest_contact}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
