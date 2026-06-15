import type { WeatherSummary } from "@/lib/weather/openMeteo";

export default function WeatherWidget({
  weather,
}: {
  weather: WeatherSummary | null;
}) {
  if (!weather) {
    return (
      <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-400">
        Weather unavailable
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-primary-50 px-4 py-3">
      <span className="text-3xl" aria-hidden="true">
        {weather.emoji}
      </span>
      <div>
        <p className="text-lg font-bold leading-none text-neutral-900">
          {weather.temperature}°C
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          {weather.description} · H {weather.high}° L {weather.low}°
        </p>
      </div>
    </div>
  );
}
