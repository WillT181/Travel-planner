"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  inviteCollaborator,
  revokeInvite,
  changeMemberRole,
  removeMember,
  transferOwnership,
} from "@/lib/trips/collaboration";
import type {
  InviteRole,
  TripInvite,
  TripMember,
  TripRole,
} from "@/types/collaboration";

interface Props {
  open: boolean;
  onClose: () => void;
  tripId: string;
  role: TripRole;
  isOwnerPro: boolean;
  members: TripMember[];
  invites: TripInvite[];
  currentUserId: string;
}

function RoleBadge({ role }: { role: TripRole }) {
  const map: Record<TripRole, string> = {
    owner: "bg-primary-100 text-primary-700",
    editor: "bg-sky-100 text-sky-700",
    viewer: "bg-neutral-100 text-neutral-600",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${map[role]}`}
    >
      {role}
    </span>
  );
}

export default function TripSettings({
  open,
  onClose,
  tripId,
  role,
  isOwnerPro,
  members,
  invites,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isOwner = role === "owner";

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("viewer");
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  function refresh() {
    router.refresh();
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setLastInviteUrl(null);
    const value = email;
    startTransition(async () => {
      const result = await inviteCollaborator(tripId, value, inviteRole);
      if (result.error) {
        setFeedback({ kind: "error", text: result.error });
        return;
      }
      setEmail("");
      setLastInviteUrl(result.inviteUrl ?? null);
      setFeedback({
        kind: "success",
        text: result.emailSent
          ? `Invite emailed to ${value}.`
          : `Invite created. Email isn't configured — copy the link below to share it.`,
      });
      refresh();
    });
  }

  function handleRoleChange(userId: string, newRole: TripRole) {
    startTransition(async () => {
      await changeMemberRole(tripId, userId, newRole);
      refresh();
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeMember(tripId, userId);
      refresh();
    });
  }

  function handleTransfer(userId: string) {
    startTransition(async () => {
      const result = await transferOwnership(tripId, userId);
      setConfirmTransfer(null);
      if (result.error) {
        setFeedback({ kind: "error", text: result.error });
        return;
      }
      refresh();
    });
  }

  function handleRevoke(inviteId: string) {
    startTransition(async () => {
      await revokeInvite(tripId, inviteId);
      refresh();
    });
  }

  const otherMembers = members.filter((m) => m.user_id !== currentUserId);

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-neutral-900/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trip settings"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">
            Trip settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── Share trip ─────────────────────────────────────────────── */}
          <section aria-labelledby="share-heading">
            <h3
              id="share-heading"
              className="text-sm font-semibold uppercase tracking-widest text-neutral-500"
            >
              Share trip
            </h3>

            {!isOwner ? (
              <p className="mt-3 text-sm text-neutral-500">
                Only the trip owner can invite collaborators.
              </p>
            ) : !isOwnerPro ? (
              <div className="mt-3 rounded-xl border border-accent-200 bg-accent-50 p-4">
                <p className="text-sm font-semibold text-accent-800">
                  Collaboration is a Pro feature
                </p>
                <p className="mt-1 text-sm text-accent-700">
                  Upgrade to invite editors and viewers to plan together.
                </p>
                <a
                  href="/pricing"
                  className="mt-2 inline-block text-sm font-semibold text-accent-900 underline underline-offset-2"
                >
                  Upgrade to Pro →
                </a>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@email.com"
                    required
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <select
                    aria-label="Role"
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as InviteRole)
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isPending || !email.trim()}
                  className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                >
                  Send invite
                </button>
              </form>
            )}

            {feedback && (
              <p
                className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                  feedback.kind === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-primary-50 text-primary-700"
                }`}
              >
                {feedback.text}
              </p>
            )}
            {lastInviteUrl && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2">
                <code className="flex-1 truncate text-xs text-neutral-600">
                  {lastInviteUrl}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(lastInviteUrl)}
                  className="shrink-0 text-xs font-semibold text-primary-700 hover:text-primary-800"
                >
                  Copy
                </button>
              </div>
            )}
          </section>

          {/* ── Members ────────────────────────────────────────────────── */}
          <section className="mt-8" aria-labelledby="members-heading">
            <h3
              id="members-heading"
              className="text-sm font-semibold uppercase tracking-widest text-neutral-500"
            >
              Members ({members.length})
            </h3>
            <ul className="mt-3 space-y-2">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="rounded-xl border border-neutral-200 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {m.email ?? "Member"}
                        {m.user_id === currentUserId && (
                          <span className="text-neutral-400"> · you</span>
                        )}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <RoleBadge role={m.role} />
                        {m.edit_requested && m.role === "viewer" && (
                          <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
                            Requested edit access
                          </span>
                        )}
                      </div>
                    </div>

                    {isOwner && m.user_id !== currentUserId && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <select
                          aria-label={`Role for ${m.email}`}
                          value={m.role === "owner" ? "editor" : m.role}
                          onChange={(e) =>
                            handleRoleChange(
                              m.user_id,
                              e.target.value as TripRole
                            )
                          }
                          disabled={isPending}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemove(m.user_id)}
                          disabled={isPending}
                          aria-label={`Remove ${m.email}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Ownership transfer */}
                  {isOwner && m.user_id !== currentUserId && (
                    <div className="mt-2 border-t border-neutral-100 pt-2">
                      {confirmTransfer === m.user_id ? (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-neutral-600">
                            Make {m.email} the owner? You become an editor.
                          </span>
                          <span className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => handleTransfer(m.user_id)}
                              disabled={isPending}
                              className="rounded-md bg-primary-600 px-2 py-1 font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmTransfer(null)}
                              className="rounded-md px-2 py-1 font-medium text-neutral-500 hover:bg-neutral-100"
                            >
                              Cancel
                            </button>
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmTransfer(m.user_id)}
                          className="text-xs font-semibold text-neutral-500 hover:text-primary-700"
                        >
                          Transfer ownership →
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {isOwner && otherMembers.length === 0 && (
              <p className="mt-2 text-sm text-neutral-400">
                No collaborators yet. Invite someone above.
              </p>
            )}
          </section>

          {/* ── Pending invites ────────────────────────────────────────── */}
          {isOwner && invites.length > 0 && (
            <section className="mt-8" aria-labelledby="invites-heading">
              <h3
                id="invites-heading"
                className="text-sm font-semibold uppercase tracking-widest text-neutral-500"
              >
                Pending invites ({invites.length})
              </h3>
              <ul className="mt-3 space-y-2">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-neutral-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {inv.invited_email}
                      </p>
                      <span className="text-xs capitalize text-neutral-500">
                        {inv.role} · pending
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(inv.id)}
                      disabled={isPending}
                      className="shrink-0 text-xs font-semibold text-neutral-500 hover:text-red-600 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
