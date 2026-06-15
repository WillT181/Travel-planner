import type { Referral, ReferralStatus } from "@/types/account";

const STATUS_META: Record<
  ReferralStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Signed up",
    className: "bg-neutral-100 text-neutral-600",
  },
  completed: {
    label: "Onboarded",
    className: "bg-primary-50 text-primary-700",
  },
  rewarded: {
    label: "Reward earned",
    className: "bg-accent-100 text-accent-700",
  },
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function maskEmail(email: string | null): string {
  if (!email) return "A friend";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const shown = local.slice(0, 2);
  return `${shown}${local.length > 2 ? "…" : ""}@${domain}`;
}

export default function ReferralTable({
  referrals,
}: {
  referrals: Referral[];
}) {
  if (referrals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
        No referrals yet. Share your link above — you&apos;ll earn a free month
        of Pro each time a friend signs up and completes onboarding.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Friend
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Joined
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {referrals.map((r) => {
            const meta = STATUS_META[r.status];
            return (
              <tr key={r.id}>
                <td className="px-4 py-3 text-neutral-800">
                  {maskEmail(r.referred_email)}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {dateFmt.format(new Date(r.created_at))}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
