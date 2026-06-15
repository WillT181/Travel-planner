export type TripRole = "owner" | "editor" | "viewer";
export type InviteRole = "editor" | "viewer";
export type InviteStatus = "pending" | "accepted" | "declined";

export interface TripMember {
  user_id: string;
  email: string | null;
  role: TripRole;
  edit_requested: boolean;
}

export interface TripInvite {
  id: string;
  invited_email: string;
  role: InviteRole;
  status: InviteStatus;
  token: string;
}

export interface InviteDetails {
  trip_id: string;
  destination_name: string | null;
  inviter_email: string | null;
  role: InviteRole;
  status: InviteStatus;
  invited_email: string;
}
