"use client";

import { updateIssueStatus, addIssueComment } from "@/app/actions/issues";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Comment = { id: string; body: string; created_at: string; author_id: string };
type Issue = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  units: { name: string; short_code: string }[] | null;
  issue_comments: Comment[];
};

const severityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const statusColors: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  ACKNOWLEDGED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

export function IssueCard({
  issue,
  isManager,
  staff,
  staffMap,
}: {
  issue: Issue;
  isManager: boolean;
  staff: { id: string; name: string }[];
  staffMap: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const router = useRouter();

  const unit = issue.units?.[0];

  async function handleStatusChange(newStatus: string) {
    setLoading(true);
    const fd = new FormData();
    fd.set("issue_id", issue.id);
    fd.set("status", newStatus);
    await updateIssueStatus(fd);
    router.refresh();
    setLoading(false);
  }

  async function handleAssign(e: React.ChangeEvent<HTMLSelectElement>) {
    setLoading(true);
    const fd = new FormData();
    fd.set("issue_id", issue.id);
    fd.set("status", issue.status === "OPEN" ? "ACKNOWLEDGED" : issue.status);
    fd.set("assignee_id", e.target.value);
    await updateIssueStatus(fd);
    router.refresh();
    setLoading(false);
  }

  async function handleComment() {
    if (!comment.trim()) return;
    setLoading(true);
    const fd = new FormData();
    fd.set("issue_id", issue.id);
    fd.set("body", comment);
    await addIssueComment(fd);
    setComment("");
    router.refresh();
    setLoading(false);
  }

  return (
    <div
      className={`rounded-lg border bg-white ${
        issue.severity === "urgent"
          ? "border-red-300"
          : issue.severity === "high"
            ? "border-orange-300"
            : "border-gray-200"
      }`}
    >
      {/* Summary */}
      <div
        className="flex cursor-pointer items-center justify-between px-5 py-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {unit && (
            <span className="text-xs font-medium text-gray-400">
              {unit.short_code}
            </span>
          )}
          <div>
            <p className="font-medium text-gray-900">{issue.title}</p>
            <p className="text-xs text-gray-500">
              {issue.category || "General"} —{" "}
              {new Date(issue.created_at).toLocaleDateString("en-ZA")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${severityColors[issue.severity] || "bg-gray-100 text-gray-600"}`}
          >
            {issue.severity}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[issue.status] || "bg-gray-100 text-gray-600"}`}
          >
            {issue.status}
          </span>
          <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {issue.description && (
            <p className="mb-4 text-sm text-gray-700">{issue.description}</p>
          )}

          {/* Manager controls */}
          {isManager && (
            <div className="mb-4 flex flex-wrap gap-3">
              {/* Assign */}
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Assign to:
                </label>
                <select
                  onChange={handleAssign}
                  disabled={loading}
                  defaultValue=""
                  className="mt-1 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Select staff...</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status buttons */}
              <div className="flex items-end gap-2">
                {issue.status === "OPEN" && (
                  <button
                    onClick={() => handleStatusChange("ACKNOWLEDGED")}
                    disabled={loading}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                )}
                {["OPEN", "ACKNOWLEDGED"].includes(issue.status) && (
                  <button
                    onClick={() => handleStatusChange("IN_PROGRESS")}
                    disabled={loading}
                    className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
                  >
                    Start Work
                  </button>
                )}
                {["ACKNOWLEDGED", "IN_PROGRESS"].includes(issue.status) && (
                  <button
                    onClick={() => handleStatusChange("RESOLVED")}
                    disabled={loading}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Comments */}
          {issue.issue_comments.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-gray-500">
                Comments:
              </p>
              <div className="space-y-2">
                {issue.issue_comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"
                  >
                    <p>{c.body}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {staffMap[c.author_id] || "Staff"} —{" "}
                      {new Date(c.created_at).toLocaleString("en-ZA")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add comment */}
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleComment();
                }
              }}
              placeholder="Add a comment..."
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleComment}
              disabled={loading || !comment.trim()}
              className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
