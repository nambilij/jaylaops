"use client";

import { generateDailyTasks } from "@/app/actions/tasks";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateButton({ date }: { date: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleGenerate() {
    setLoading(true);
    setMessage("");
    const formData = new FormData();
    formData.set("date", date);
    const result = await generateDailyTasks(formData);

    if ("error" in result && result.error) {
      setMessage(result.error);
    } else if ("count" in result) {
      setMessage(`Created ${result.count} tasks.`);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="text-right">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate Today's Tasks"}
      </button>
      {message && (
        <p className="mt-2 text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
}
