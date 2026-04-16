"use client";

import {
  assignTask,
  startTask,
  completeTask,
  inspectTask,
} from "@/app/actions/tasks";
import { useState } from "react";
import { useRouter } from "next/navigation";

type ChecklistItem = { id: string; label: string; sort_order: number };
type Task = {
  id: string;
  status: string;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  inspected_at: string | null;
  rejection_reason: string | null;
  assignee_id: string | null;
  checklist_state: { id: string; checked: boolean }[] | null;
  units: { id: string; name: string; short_code: string }[] | null;
  task_templates: {
    id: string;
    name: string;
    estimated_minutes: number;
    required_photos: number;
    task_checklist_items: ChecklistItem[];
  }[] | null;
};

const statusColors: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  AWAITING_INSPECTION: "bg-purple-100 text-purple-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-500",
  GENERATED: "bg-gray-100 text-gray-600",
};

export function TaskRow({
  task,
  currentUserId,
  currentUserRole,
  assignableStaff,
  staffMap,
}: {
  task: Task;
  currentUserId: string;
  currentUserRole: string;
  assignableStaff: { id: string; name: string }[];
  staffMap: Record<string, string>;
}) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [checkState, setCheckState] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    (task.checklist_state || []).forEach((item) => {
      state[item.id] = item.checked;
    });
    return state;
  });
  const [inspectNotes, setInspectNotes] = useState("");
  const [inspectScore, setInspectScore] = useState("5");
  const router = useRouter();

  const unit = task.units?.[0];
  const template = task.task_templates?.[0];
  const checklistItems = template?.task_checklist_items || [];
  const isManager = ["super_admin", "manager", "supervisor"].includes(currentUserRole);
  const isAssignee = task.assignee_id === currentUserId;
  const assigneeName = task.assignee_id ? staffMap[task.assignee_id] || "Unknown" : "Unassigned";

  async function handleAssign(e: React.ChangeEvent<HTMLSelectElement>) {
    setLoading(true);
    const fd = new FormData();
    fd.set("task_id", task.id);
    fd.set("assignee_id", e.target.value);
    await assignTask(fd);
    router.refresh();
    setLoading(false);
  }

  async function handleStart() {
    setLoading(true);
    const fd = new FormData();
    fd.set("task_id", task.id);
    await startTask(fd);
    router.refresh();
    setLoading(false);
  }

  async function handleComplete() {
    setLoading(true);
    const fd = new FormData();
    fd.set("task_id", task.id);
    const stateArray = checklistItems.map((item) => ({
      id: item.id,
      checked: checkState[item.id] || false,
    }));
    fd.set("checklist_state", JSON.stringify(stateArray));
    await completeTask(fd);
    router.refresh();
    setLoading(false);
  }

  async function handleInspect(result: "approved" | "rejected") {
    setLoading(true);
    const fd = new FormData();
    fd.set("task_id", task.id);
    fd.set("result", result);
    fd.set("notes", inspectNotes);
    fd.set("score", inspectScore);
    await inspectTask(fd);
    router.refresh();
    setLoading(false);
  }

  function toggleCheck(itemId: string) {
    setCheckState((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Summary row */}
      <div
        className="flex cursor-pointer items-center justify-between px-5 py-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-400">
            {unit?.short_code || "?"}
          </span>
          <div>
            <p className="font-medium text-gray-900">
              {template?.name || "Task"}{" "}
              <span className="text-sm font-normal text-gray-500">
                — {unit?.name || "Unknown room"}
              </span>
            </p>
            <p className="text-xs text-gray-500">
              Assigned to: {assigneeName}
              {template ? ` · ~${template.estimated_minutes} min` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[task.status] || "bg-gray-100 text-gray-600"}`}
          >
            {task.status.replace(/_/g, " ")}
          </span>
          <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {/* Rejection reason */}
          {task.status === "REJECTED" && task.rejection_reason && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Rejected: {task.rejection_reason}
            </div>
          )}

          {/* Assignment (managers only, pending tasks) */}
          {isManager && (task.status === "PENDING" || task.status === "GENERATED") && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Assign to:
              </label>
              <select
                value={task.assignee_id || ""}
                onChange={handleAssign}
                disabled={loading}
                className="mt-1 block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Unassigned</option>
                {assignableStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Checklist (visible when in progress or awaiting inspection) */}
          {checklistItems.length > 0 &&
            ["IN_PROGRESS", "AWAITING_INSPECTION", "APPROVED", "REJECTED"].includes(task.status) && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Checklist:
                </p>
                <ul className="space-y-1">
                  {checklistItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checkState[item.id] || false}
                        onChange={() => toggleCheck(item.id)}
                        disabled={task.status !== "IN_PROGRESS" || (!isAssignee && !isManager)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span
                        className={`text-sm ${checkState[item.id] ? "text-gray-400 line-through" : "text-gray-700"}`}
                      >
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Start button */}
            {(task.status === "PENDING" || task.status === "REJECTED") &&
              (isAssignee || isManager) && (
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
                >
                  {loading ? "Starting..." : "Start Task"}
                </button>
              )}

            {/* Complete button */}
            {task.status === "IN_PROGRESS" && (isAssignee || isManager) && (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Completing..." : "Mark Complete"}
              </button>
            )}

            {/* Inspection controls */}
            {task.status === "AWAITING_INSPECTION" && isManager && (
              <div className="w-full space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input
                      value={inspectNotes}
                      onChange={(e) => setInspectNotes(e.target.value)}
                      placeholder="Notes (required for rejection)"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <select
                      value={inspectScore}
                      onChange={(e) => setInspectScore(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="5">5 - Excellent</option>
                      <option value="4">4 - Good</option>
                      <option value="3">3 - OK</option>
                      <option value="2">2 - Poor</option>
                      <option value="1">1 - Fail</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleInspect("approved")}
                    disabled={loading}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? "..." : "Approve"}
                  </button>
                  <button
                    onClick={() => handleInspect("rejected")}
                    disabled={loading || !inspectNotes}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? "..." : "Reject"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="mt-3 text-xs text-gray-400">
            {task.started_at && (
              <span>
                Started: {new Date(task.started_at).toLocaleTimeString("en-ZA")}{" "}
              </span>
            )}
            {task.completed_at && (
              <span>
                · Completed:{" "}
                {new Date(task.completed_at).toLocaleTimeString("en-ZA")}{" "}
              </span>
            )}
            {task.inspected_at && (
              <span>
                · Inspected:{" "}
                {new Date(task.inspected_at).toLocaleTimeString("en-ZA")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
