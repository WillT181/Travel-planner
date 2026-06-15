import type { TripMember } from "@/types/collaboration";

function initials(member: TripMember): string {
  const source = member.email ?? "?";
  const namePart = source.split("@")[0] ?? source;
  const chunks = namePart.split(/[.\-_]+/).filter(Boolean);
  if (chunks.length >= 2) {
    return (chunks[0][0] + chunks[1][0]).toUpperCase();
  }
  return namePart.slice(0, 2).toUpperCase();
}

// Deterministic colour from the user id so each member keeps a stable hue.
const PALETTE = [
  "#0d9488",
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function MemberAvatars({
  members,
  currentUserId,
}: {
  members: TripMember[];
  currentUserId: string;
}) {
  if (members.length <= 1) return null;

  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((m) => (
          <span
            key={m.user_id}
            title={`${m.email ?? "Member"}${m.role === "owner" ? " (owner)" : ""}${
              m.user_id === currentUserId ? " · you" : ""
            }`}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white ring-0"
            style={{ backgroundColor: colorFor(m.user_id) }}
          >
            {initials(m)}
          </span>
        ))}
        {extra > 0 && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-xs font-semibold text-neutral-600">
            +{extra}
          </span>
        )}
      </div>
      <span className="ml-3 text-sm text-neutral-500">
        {members.length} collaborators
      </span>
    </div>
  );
}
