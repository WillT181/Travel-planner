"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidCurrency } from "@/lib/currency";

export interface AccountResult {
  error?: string;
  message?: string;
}

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?returnTo=/account");
  return { supabase, user };
}

// ── Profile (display name) ─────────────────────────────────────────────────

export async function updateDisplayName(
  displayName: string
): Promise<AccountResult> {
  const { supabase, user } = await requireUser();
  const name = displayName.trim();
  if (name.length > 80) {
    return { error: "That name is a little too long." };
  }

  const { error } = await supabase
    .from("user_profiles")
    .upsert({ id: user.id, display_name: name || null }, { onConflict: "id" });

  if (error) return { error: "Couldn't save your name. Please try again." };

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return { message: "Your name has been updated." };
}

// ── Email ────────────────────────────────────────────────────────────────────

export async function updateEmail(email: string): Promise<AccountResult> {
  const { supabase } = await requireUser();
  const next = email.trim().toLowerCase();
  if (!next || !next.includes("@")) {
    return { error: "Please enter a valid email address." };
  }

  const { error } = await supabase.auth.updateUser({ email: next });
  if (error) return { error: error.message };

  return {
    message:
      "Check your inbox — we've sent a link to confirm your new email address.",
  };
}

// ── Password ─────────────────────────────────────────────────────────────────

export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<AccountResult> {
  const { supabase, user } = await requireUser();

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  // Re-verify the current password before allowing a change.
  if (user.email) {
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (reauthError) {
      return { error: "Your current password is incorrect." };
    }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return { message: "Your password has been changed." };
}

// ── Currency preference ────────────────────────────────────────────────────

export async function updateCurrency(code: string): Promise<AccountResult> {
  const { supabase, user } = await requireUser();
  if (!isValidCurrency(code)) {
    return { error: "That currency isn't supported." };
  }

  const { error } = await supabase
    .from("user_profiles")
    .upsert({ id: user.id, currency: code }, { onConflict: "id" });

  if (error) return { error: "Couldn't save your currency. Please try again." };

  revalidatePath("/account");
  return { message: "Default currency updated." };
}

// ── Delete account ───────────────────────────────────────────────────────────

export async function deleteAccount(confirm: string): Promise<AccountResult> {
  const { supabase, user } = await requireUser();

  if (confirm.trim() !== "DELETE") {
    return { error: 'Please type "DELETE" to confirm.' };
  }

  // Hard-delete via the service-role admin client. FK cascades remove the
  // profile, trips, days, activities, budgets, memberships and referrals.
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error)
      return { error: "Couldn't delete your account. Please try again." };
  } catch {
    return {
      error:
        "Account deletion isn't available right now. Please contact support.",
    };
  }

  await supabase.auth.signOut();
  redirect("/");
}
