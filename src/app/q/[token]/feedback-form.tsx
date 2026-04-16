"use client";

import { submitFeedback } from "@/app/actions/feedback";
import { useState } from "react";

function StarRating({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`text-3xl transition-colors ${
              star <= value ? "text-yellow-400" : "text-gray-300"
            }`}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export function FeedbackForm({
  qrToken,
  unitName,
}: {
  qrToken: string;
  unitName: string;
}) {
  const [cleanliness, setCleanliness] = useState(0);
  const [comfort, setComfort] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [overall, setOverall] = useState(0);
  const [cleanOnArrival, setCleanOnArrival] = useState<boolean | null>(null);
  const [comments, setComments] = useState("");
  const [guestContact, setGuestContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (overall === 0) {
      setError("Please provide an overall rating.");
      return;
    }
    if (cleanOnArrival === null) {
      setError("Please indicate if the room was clean on arrival.");
      return;
    }

    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.set("qr_token", qrToken);
    fd.set("cleanliness", String(cleanliness));
    fd.set("comfort", String(comfort));
    fd.set("communication", String(communication));
    fd.set("overall", String(overall));
    fd.set("clean_on_arrival", String(cleanOnArrival));
    fd.set("comments", comments);
    fd.set("guest_contact", guestContact);
    fd.set("website", ""); // honeypot — should always be empty

    const result = await submitFeedback(fd);

    if ("error" in result && result.error) {
      setError(result.error);
    } else if ("referenceNumber" in result) {
      setRefNumber(result.referenceNumber!);
      setIsUrgent(result.isUrgent || false);
      setSubmitted(true);
    }
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
        <div className="text-4xl">✅</div>
        <h2 className="mt-4 text-xl font-bold text-gray-900">
          Thank you for your feedback!
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Reference: <strong>{refNumber}</strong>
        </p>
        {isUrgent && (
          <p className="mt-3 rounded-lg bg-yellow-100 px-4 py-2 text-sm text-yellow-800">
            A manager has been notified and will contact you shortly.
          </p>
        )}
        <p className="mt-4 text-xs text-gray-400">
          You can close this page now.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Ratings */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <StarRating
          label="Cleanliness"
          name="cleanliness"
          value={cleanliness}
          onChange={setCleanliness}
        />
        <StarRating
          label="Comfort"
          name="comfort"
          value={comfort}
          onChange={setComfort}
        />
        <StarRating
          label="Communication"
          name="communication"
          value={communication}
          onChange={setCommunication}
        />
        <StarRating
          label="Overall Experience *"
          name="overall"
          value={overall}
          onChange={setOverall}
        />
      </div>

      {/* Clean on arrival */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Was the room clean when you arrived? *
        </label>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => setCleanOnArrival(true)}
            className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
              cleanOnArrival === true
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setCleanOnArrival(false)}
            className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
              cleanOnArrival === false
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            No
          </button>
        </div>
      </div>

      {/* Comments */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Comments or suggestions
        </label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          placeholder="Tell us about your experience..."
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Contact (optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Contact (optional)
        </label>
        <p className="text-xs text-gray-500">
          Leave your email or phone if you&apos;d like us to follow up.
        </p>
        <input
          value={guestContact}
          onChange={(e) => setGuestContact(e.target.value)}
          placeholder="Email or phone number"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Honeypot — hidden from real users, bots will fill it */}
      <div className="hidden" aria-hidden="true">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Feedback"}
      </button>

      <p className="text-center text-xs text-gray-400">
        Your feedback helps us improve. By submitting, you consent to us
        storing this response for up to 24 months in accordance with POPIA.
      </p>
    </form>
  );
}
