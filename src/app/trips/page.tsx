import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Trips",
};

export default function TripsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-neutral-900">My Trips</h1>
      <p className="mt-2 text-neutral-500">
        All your saved trips in one place — view, edit, or share your plans.
      </p>
    </div>
  );
}
