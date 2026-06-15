import type { ReactNode } from "react";

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 w-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ItineraryIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 w-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 w-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

interface Step {
  number: string;
  title: string;
  copy: string;
  icon: ReactNode;
}

const STEPS: Step[] = [
  {
    number: "01",
    title: "Search your destination",
    copy: "Find any city, region, or landmark worldwide and pull in photos, ratings, and local highlights instantly.",
    icon: <SearchIcon />,
  },
  {
    number: "02",
    title: "Build your itinerary",
    copy: "Drag activities into a day-by-day plan, add notes and bookings, and watch your whole trip come together.",
    icon: <ItineraryIcon />,
  },
  {
    number: "03",
    title: "Travel with confidence",
    copy: "Access your plans offline, share them with travel companions, and stay on track from takeoff to touchdown.",
    icon: <ShieldIcon />,
  },
];

export default function HowItWorks() {
  return (
    <section className="py-16 sm:py-20" aria-labelledby="how-it-works-heading">
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="how-it-works-heading"
          className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl"
        >
          Planning a trip has never been this simple
        </h2>
        <p className="mt-4 text-lg text-neutral-600">
          Three steps from daydream to departure.
        </p>
      </div>

      <ol className="mt-12 grid gap-8 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.number}
            className="flex flex-col items-center text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              {step.icon}
            </div>
            <span className="mt-4 text-sm font-semibold tracking-wide text-accent-600">
              STEP {step.number}
            </span>
            <h3 className="mt-1 text-xl font-semibold text-neutral-900">
              {step.title}
            </h3>
            <p className="mt-2 max-w-xs text-neutral-600">{step.copy}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
