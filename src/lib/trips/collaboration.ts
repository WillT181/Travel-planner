"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/auth/plan";
import { sendInviteEmail } from "@/lib/email/resend";
import type { InviteRole, TripRole } from "@/types/collaboration";

export interface ActionResult {
  error?: string;
}

function getOrigin(): string {
  const hdrs = headers();
  const origin = hdrs.get("origin");
  if (origin) return origin;
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Confirms the current user owns the trip; returns their user id + email. */
async function requireOwner(
  supabase: ReturnType<typeof createClient>,
  tripId: string
): Promise<{ userId: string; email: string | null } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return { error: "Only the trip owner can do that." };

  return { userId: user.id, email: user.email ?? null };
}

// ── inviteCollaborator ───────────────────────────────────────────────────────

export interface InviteResult extends ActionResult {
  inviteUrl?: string;
  emailSent?: boolean;
}

export async function inviteCollaborator(
  tripId: string,
  email: string,
  role: InviteRole
): Promise<InviteResult> {
  const supabase = createClient();
  const owner = await requireOwner(supabase, tripId);
  if ("error" in owner) return owner;

  // Collaboration is a Pro feature for the trip owner.
  const plan = await getUserPlan(supabase);
  if (plan !== "pro") {
    return { error: "Collaboration is a Pro feature. Upgrade to invite." };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail))
    return { error: "Enter a valid email address." };
  if (cleanEmail === owner.email?.toLowerCase()) {
    return { error: "You're already on this trip." };
  }
  if (role !== "editor" && role !== "viewer") {
    return { error: "Invalid role." };
  }

  // Already a member?
  const { data: existingMember } = await supabase
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("email", cleanEmail)
    .maybeSingle();
  if (existingMember) {
    return { error: "That person is already a member of this trip." };
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("destination_name, title")
    .eq("id", tripId)
    .single();
  const tripName = trip?.title || trip?.destination_name || "a trip";

  // Reuse an existing pending invite for the same email, otherwise create one.
  const { data: pending } = await supabase
    .from("trip_invites")
    .select("id, token")
    .eq("trip_id", tripId)
    .eq("invited_email", cleanEmail)
    .eq("status", "pending")
    .maybeSingle();

  let token = pending?.token as string | undefined;
  if (token) {
    // Keep the role in sync with the latest invite.
    await supabase.from("trip_invites").update({ role }).eq("id", pending!.id);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("trip_invites")
      .insert({
        trip_id: tripId,
        invited_email: cleanEmail,
        role,
        status: "pending",
        invited_by: owner.userId,
      })
      .select("token")
      .single();
    if (insErr || !inserted) {
      return { error: "Couldn't create the invite. Please try again." };
    }
    token = inserted.token as string;
  }

  const inviteUrl = `${getOrigin()}/invite/${token}`;

  const result = await sendInviteEmail({
    to: cleanEmail,
    inviteUrl,
    tripName,
    inviterEmail: owner.email,
    role,
  });

  revalidatePath(`/trip/${tripId}`);
  return { inviteUrl, emailSent: result.sent };
}

// ── revokeInvite ─────────────────────────────────────────────────────────────

export async function revokeInvite(
  tripId: string,
  inviteId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const owner = await requireOwner(supabase, tripId);
  if ("error" in owner) return owner;

  const { error } = await supabase
    .from("trip_invites")
    .delete()
    .eq("id", inviteId)
    .eq("trip_id", tripId);
  if (error) return { error: "Couldn't revoke the invite." };

  revalidatePath(`/trip/${tripId}`);
  return {};
}

// ── acceptInvite / declineInvite (invitee actions) ───────────────────────────

export interface AcceptResult extends ActionResult {
  tripId?: string;
}

function mapInviteError(message: string): string {
  if (message.includes("EMAIL_MISMATCH"))
    return "This invite was sent to a different email address. Sign in with that address to accept.";
  if (message.includes("INVITE_NOT_PENDING"))
    return "This invite has already been used.";
  if (message.includes("INVITE_NOT_FOUND"))
    return "This invite link is no longer valid.";
  if (message.includes("NOT_AUTHENTICATED"))
    return "Please sign in to accept this invite.";
  return "We couldn't process this invite.";
}

export async function acceptInvite(token: string): Promise<AcceptResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("accept_trip_invite", {
    _token: token,
  });
  if (error) return { error: mapInviteError(error.message) };

  const tripId = data as string;
  revalidatePath(`/trip/${tripId}`);
  return { tripId };
}

export async function declineInvite(token: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("decline_trip_invite", {
    _token: token,
  });
  if (error) return { error: mapInviteError(error.message) };
  return {};
}

// ── Member management (owner) ────────────────────────────────────────────────

export async function changeMemberRole(
  tripId: string,
  memberUserId: string,
  role: TripRole
): Promise<ActionResult> {
  const supabase = createClient();
  const owner = await requireOwner(supabase, tripId);
  if ("error" in owner) return owner;

  if (role !== "editor" && role !== "viewer") {
    return { error: "Roles can only be set to Editor or Viewer here." };
  }
  if (memberUserId === owner.userId) {
    return { error: "Use ownership transfer to change the owner." };
  }

  const { error } = await supabase
    .from("trip_members")
    .update({ role, edit_requested: false })
    .eq("trip_id", tripId)
    .eq("user_id", memberUserId);
  if (error) return { error: "Couldn't update the member's role." };

  revalidatePath(`/trip/${tripId}`);
  return {};
}

export async function removeMember(
  tripId: string,
  memberUserId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const owner = await requireOwner(supabase, tripId);
  if ("error" in owner) return owner;

  if (memberUserId === owner.userId) {
    return { error: "The owner can't be removed. Transfer ownership first." };
  }

  const { error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", memberUserId);
  if (error) return { error: "Couldn't remove that member." };

  revalidatePath(`/trip/${tripId}`);
  return {};
}

export async function transferOwnership(
  tripId: string,
  newOwnerUserId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const owner = await requireOwner(supabase, tripId);
  if ("error" in owner) return owner;

  const { error } = await supabase.rpc("transfer_trip_ownership", {
    _trip_id: tripId,
    _new_owner: newOwnerUserId,
  });
  if (error) {
    if (error.message.includes("NOT_A_MEMBER"))
      return { error: "That person isn't a member of this trip." };
    return { error: "Couldn't transfer ownership." };
  }

  revalidatePath(`/trip/${tripId}`);
  return {};
}

// ── requestEditAccess (viewer) ───────────────────────────────────────────────

export async function requestEditAccess(tripId: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // A user may only flag their own membership row (enforced by RLS too).
  const { error } = await supabase
    .from("trip_members")
    .update({ edit_requested: true })
    .eq("trip_id", tripId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't send your request." };

  revalidatePath(`/trip/${tripId}`);
  return {};
}
