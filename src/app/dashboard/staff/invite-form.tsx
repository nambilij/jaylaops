"use client";

import { inviteStaff } from "@/app/actions/staff";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = { id: string; name: string; label: string };

export function InviteForm({ roles }: { roles: Role[] }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    setSuccess("");

    const result = await inviteStaff(formData);

    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(
        `Staff invited! Temporary password: ${result.tempPassword} — share it securely, they should change it on first login.`
      );
      router.refresh();
    }
    setLoading(false);
  }

  // Don't allow inviting super_admin — only one owner
  const assignableRoles = roles.filter((r) => r.name !== "super_admin");

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="full_name"
            className="block text-sm font-medium text-gray-700"
          >
            Full Name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. Maria Nakale"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="maria@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="role_id"
            className="block text-sm font-medium text-gray-700"
          >
            Role
          </label>
          <select
            id="role_id"
            name="role_id"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a role...</option>
            {assignableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? "Inviting..." : "Invite Staff"}
      </button>
    </form>
  );
}
