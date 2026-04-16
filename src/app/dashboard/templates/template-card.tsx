"use client";

import { deactivateTemplate } from "@/app/actions/templates";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Area = { id: string; name: string };
type ChecklistItem = { id: string; label: string; sort_order: number };
type Template = {
  id: string;
  name: string;
  description: string | null;
  area_id: string | null;
  cadence: string;
  estimated_minutes: number;
  required_photos: number;
  is_active: boolean;
  areas: { name: string }[] | null;
  task_checklist_items: ChecklistItem[];
};

const cadenceLabels: Record<string, string> = {
  daily: "Daily",
  checkin: "Check-in",
  checkout: "Check-out",
  weekly: "Weekly",
};

export function TemplateCard({
  template,
  areas,
}: {
  template: Template;
  areas: Area[];
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const areaName = template.areas?.[0]?.name || "General";

  async function handleDeactivate() {
    setLoading(true);
    const formData = new FormData();
    formData.set("template_id", template.id);
    await deactivateTemplate(formData);
    router.refresh();
    setLoading(false);
  }

  return (
    <div
      className={`rounded-lg border bg-white p-5 ${
        template.is_active
          ? "border-gray-200"
          : "border-gray-200 opacity-50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-gray-900">
            {template.name}
            {!template.is_active && (
              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                Inactive
              </span>
            )}
          </h4>
          {template.description && (
            <p className="mt-1 text-sm text-gray-500">
              {template.description}
            </p>
          )}
        </div>

        {template.is_active && (
          <button
            onClick={handleDeactivate}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
          >
            Deactivate
          </button>
        )}
      </div>

      {/* Meta badges */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
          {cadenceLabels[template.cadence] || template.cadence}
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
          {areaName}
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
          ~{template.estimated_minutes} min
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
          {template.required_photos} photo{template.required_photos !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Checklist */}
      {template.task_checklist_items.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500">Checklist:</p>
          <ol className="mt-1 space-y-0.5">
            {template.task_checklist_items.map((item, i) => (
              <li key={item.id} className="text-sm text-gray-700">
                {i + 1}. {item.label}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
