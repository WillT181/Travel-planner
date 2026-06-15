import type { ItineraryDay } from "@/data/destinations";

const SLOTS: { key: keyof ItineraryDay; label: string; icon: JSX.Element }[] = [
  {
    key: "morning",
    label: "Morning",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
      </svg>
    ),
  },
  {
    key: "afternoon",
    label: "Afternoon",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4" />
      </svg>
    ),
  },
  {
    key: "evening",
    label: "Evening",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    ),
  },
];

export default function ItineraryTimeline({ days }: { days: ItineraryDay[] }) {
  return (
    <ol className="space-y-8">
      {days.map((day, index) => (
        <li key={index} className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
              {index + 1}
            </span>
            <h3 className="text-lg font-semibold text-neutral-900">
              Day {index + 1}
            </h3>
          </div>

          <div className="ml-4 mt-3 space-y-3 border-l-2 border-neutral-200 pl-6">
            {SLOTS.map((slot) => (
              <div key={slot.key} className="relative">
                <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary-600 ring-2 ring-primary-100">
                  {slot.icon}
                </span>
                <p className="text-sm font-medium text-neutral-500">
                  {slot.label}
                </p>
                <p className="text-neutral-800">{day[slot.key]}</p>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
