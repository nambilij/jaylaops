"use client";

import { updateStaffRole, toggleStaffActive } from "@/app/actions/staff";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = { id: string; name: string; label: string };
type Member = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role_id: string | null;
  roles: { id: string; name: string; label: string }[] | null;
};

export function StaffRow({
  member,
  roles,
  currentUserId,
}: {
  member: Member;
  roles: Role[];
  currentUserId: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const isMe = member.id === currentUserId;
  const memberRole = member.roles?.[0] ?? null;
  const roleName = memberRole?.name;

  async function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setLoading(true);
    const formData = new FormData();
    formData.set("staff_id", member.id);
    formData.set("role_id", e.target.value);
    await updateStaffRole(formData);
    router.refresh();
    setLoading(false);
  }

  async function handleToggleActive() {
    setLoading(true);
    const formData = new FormData();
    formData.set("staff_id", member.id);
    formData.set("is_active", String(member.is_active));
    await toggleStaffActive(formData);
    router.refresh();
    setLoading(false);
  }

  // Don't allow assigning super_admin to others
  const assignableRoles = roles.filter((r) => r.name !== "super_admin");

  return (
    <tr className={!member.is_active ? "bg-gray-50 opacity-60" : ""}>
      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
        {member.full_name || "—"}
        {isMe && (
          <span className="ml-2 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
            you
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
        {member.email}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm">
        {isMe || roleName === "super_admin" ? (
          <span className="inline-block rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
            {memberRole?.label || "No role"}
          </span>
        ) : (
          <select
            value={member.role_id || ""}
            onChange={handleRoleChange}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">No role</option>
            {assignableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-sm">
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
            member.is_active
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {member.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
        {!isMe && roleName !== "super_admin" && (
          <button
            onClick={handleToggleActive}
            disabled={loading}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {member.is_active ? "Deactivate" : "Activate"}
          </button>
        )}
      </td>
    </tr>
  );
}
