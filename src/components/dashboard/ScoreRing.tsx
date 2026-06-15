interface ScoreRingProps {
  value: number; // 0–100
  size?: number;
  label?: string;
}

/** Circular completion indicator: red → amber → teal as the value climbs. */
export default function ScoreRing({
  value,
  size = 72,
  label = "complete",
}: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const color =
    clamped >= 80
      ? "rgb(var(--color-primary-600))"
      : clamped >= 40
        ? "rgb(var(--color-accent-500))"
        : "rgb(var(--color-neutral-400))";

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${clamped}% ${label}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--color-neutral-200))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <span className="absolute text-sm font-bold text-neutral-900">
        {clamped}%
      </span>
    </div>
  );
}
