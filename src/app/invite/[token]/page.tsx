import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/Button";
import InviteActions from "@/components/trip/InviteActions";
import type { InviteDetails } from "@/types/collaboration";

export const metadata: Metadata = { title: "Trip invitation" };

interface PageProps {
  params: { token: string };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-16">
      <div className="mb-6 flex items-center justify-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-accent-500" />
        <span className="text-lg font-extrabold tracking-tight text-primary-700">
          Wanderly
        </span>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = params;
  const supabase = createClient();

  const { data: rows } = await supabase.rpc("invite_details", {
    _token: token,
  });
  const invite = (rows?.[0] as InviteDetails | undefined) ?? null;

  if (!invite) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Invitation not found
        </h1>
        <p className="mt-2 text-neutral-600">
          This invite link is invalid or has been revoked.
        </p>
        <Link
          href="/explore"
          className={buttonVariants({ variant: "primary", className: "mt-6" })}
        >
          Explore destinations
        </Link>
      </Shell>
    );
  }

  const destinationName = invite.destination_name ?? "a trip";

  if (invite.status !== "pending") {
    return (
      <Shell>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          This invite has already been{" "}
          {invite.status === "accepted" ? "accepted" : "declined"}
        </h1>
        <p className="mt-2 text-neutral-600">
          {invite.status === "accepted"
            ? "You can open the trip from your trips list."
            : "Ask the trip owner to send a new invitation."}
        </p>
        <Link
          href={
            invite.status === "accepted"
              ? `/trip/${invite.trip_id}`
              : "/explore"
          }
          className={buttonVariants({ variant: "primary", className: "mt-6" })}
        >
          {invite.status === "accepted" ? "Open trip" : "Explore destinations"}
        </Link>
      </Shell>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged out — prompt to authenticate, returning here to finish the join.
  if (!user) {
    const returnTo = `/invite/${token}`;
    return (
      <Shell>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          You&apos;re invited to {destinationName}
        </h1>
        <p className="mt-2 text-neutral-600">
          {invite.inviter_email ? `${invite.inviter_email} ` : "Someone "}
          invited you to collaborate as{" "}
          <span className="font-semibold">{invite.role}</span>. Create a free
          account (or sign in) with{" "}
          <span className="font-semibold">{invite.invited_email}</span> to
          accept.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            Sign up to accept
          </Link>
          <Link
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            I already have an account
          </Link>
        </div>
      </Shell>
    );
  }

  // Logged in with the wrong email — guide them to switch accounts.
  const emailMatches =
    (user.email ?? "").toLowerCase() === invite.invited_email.toLowerCase();

  if (!emailMatches) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Wrong account
        </h1>
        <p className="mt-2 text-neutral-600">
          This invitation was sent to{" "}
          <span className="font-semibold">{invite.invited_email}</span>, but
          you&apos;re signed in as{" "}
          <span className="font-semibold">{user.email}</span>. Sign in with the
          invited address to accept.
        </p>
        <Link
          href={`/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`}
          className={buttonVariants({ variant: "primary", className: "mt-6" })}
        >
          Switch account
        </Link>
      </Shell>
    );
  }

  // Logged in with the right email — show accept / decline.
  return (
    <Shell>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
        Join {destinationName}
      </h1>
      <p className="mb-6 mt-2 text-neutral-600">
        {invite.inviter_email ? `${invite.inviter_email} ` : "Someone "}
        invited you to collaborate on this trip as{" "}
        <span className="font-semibold">{invite.role}</span>.
      </p>
      <InviteActions
        token={token}
        destinationName={destinationName}
        role={invite.role}
      />
    </Shell>
  );
}
