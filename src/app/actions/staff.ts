"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";

/** Verify the current user is super_admin or manager. */
async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role_id, property_id, roles(name)")
    .eq("id", user.id)
    .single();

  const roleName = (profile?.roles as unknown as { name: string } | null)?.name;
  if (roleName !== "super_admin" && roleName !== "manager") {
    return { error: "Only managers and admins can manage staff." };
  }

  return { user, profile, roleName };
}

/** Invite a new staff member by email. Creates auth user + sets role & property. */
export async function inviteStaff(formData: FormData) {
  const auth = await requireManager();
  if ("error" in auth) return auth;

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const fullName = (formData.get("full_name") as string)?.trim();
  const roleId = formData.get("role_id") as string;

  if (!email || !fullName || !roleId) {
    return { error: "Email, name, and role are required." };
  }

  const admin = createAdminClient();

  // Create the auth user with a temporary password (they'll reset on first login)
  const tempPassword = crypto.randomUUID().slice(0, 16);
  const { data: newUser, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

  if (createError) {
    if (createError.message.includes("already been registered")) {
      return { error: "A user with this email already exists." };
    }
    return { error: createError.message };
  }

  // Update the profile with role and property
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role_id: roleId,
      property_id: auth.profile!.property_id,
      full_name: fullName,
    })
    .eq("id", newUser.user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  // Send password reset email so staff can set their own password
  await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  await logAudit({
    actor_id: auth.user.id,
    action: "user.invited",
    entity: "profiles",
    entity_id: newUser.user.id,
    diff: { email, full_name: fullName, role_id: roleId },
  });

  return { success: true, tempPassword };
}

/** Update a staff member's role. */
export async function updateStaffRole(formData: FormData) {
  const auth = await requireManager();
  if ("error" in auth) return auth;

  const staffId = formData.get("staff_id") as string;
  const roleId = formData.get("role_id") as string;

  if (!staffId || !roleId) {
    return { error: "Staff ID and role are required." };
  }

  // Prevent demoting yourself
  if (staffId === auth.user.id) {
    return { error: "You cannot change your own role." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role_id: roleId })
    .eq("id", staffId)
    .eq("property_id", auth.profile!.property_id);

  if (error) return { error: error.message };

  await logAudit({
    actor_id: auth.user.id,
    action: "staff.role_changed",
    entity: "profiles",
    entity_id: staffId,
    diff: { new_role_id: roleId },
  });

  return { success: true };
}

/** Toggle a staff member's active status. */
export async function toggleStaffActive(formData: FormData) {
  const auth = await requireManager();
  if ("error" in auth) return auth;

  const staffId = formData.get("staff_id") as string;
  const isActive = formData.get("is_active") === "true";

  if (staffId === auth.user.id) {
    return { error: "You cannot deactivate yourself." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: !isActive })
    .eq("id", staffId)
    .eq("property_id", auth.profile!.property_id);

  if (error) return { error: error.message };

  await logAudit({
    actor_id: auth.user.id,
    action: isActive ? "staff.deactivated" : "staff.activated",
    entity: "profiles",
    entity_id: staffId,
  });

  return { success: true };
}
