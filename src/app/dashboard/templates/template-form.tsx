"use client";

import { createTemplate } from "@/app/actions/templates";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Area = { id: string; name: string };

export function TemplateForm({ areas }: { areas: Area[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const router = useRouter();

  function addChecklistItem() {
    const trimmed = newItem.trim();
    if (trimmed) {
      setChecklist([...checklist, trimmed]);
      setNewItem("");
    }
  }

  function removeChecklistItem(index: number) {
    setChecklist(checklist.filter((_, i) => i !== index));
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    formData.set("checklist", JSON.stringify(checklist));
    const result = await createTemplate(formData);
    if ("error" in result && result.error) {
      setError(result.error);
    } else {
      setOpen(false);
      setChecklist([]);
      router.refresh();
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
      >
        + New Template
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">
        Create Task Template
      </h3>

      <form action={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Task Name *
          </label>
          <input
            name="name"
            required
            placeholder="e.g. Clean Bathroom"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            name="description"
            rows={2}
            placeholder="Optional instructions for the housekeeper"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Area, Cadence, Time, Photos — row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Area
            </label>
            <select
              name="area_id"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Any / General</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Cadence
            </label>
            <select
              name="cadence"
              defaultValue="daily"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="daily">Daily</option>
              <option value="checkin">Check-in</option>
              <option value="checkout">Check-out</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Est. Minutes
            </label>
            <input
              name="estimated_minutes"
              type="number"
              defaultValue={30}
              min={5}
              max={480}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Required Photos
            </label>
            <input
              name="required_photos"
              type="number"
              defaultValue={1}
              min={0}
              max={10}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Checklist items */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Checklist Steps
          </label>
          <p className="mb-2 text-xs text-gray-500">
            Add the steps a housekeeper must follow when doing this task.
          </p>

          {checklist.length > 0 && (
            <ul className="mb-2 space-y-1">
              {checklist.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <span>
                    {i + 1}. {item}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(i)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addChecklistItem();
                }
              }}
              placeholder="e.g. Strip and replace bedding"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addChecklistItem}
              className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Add Step
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Template"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setChecklist([]);
              setError("");
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
