/**
 * Lightweight Open-Meteo client (no API key required). Used by the dashboard to
 * show a small weather widget for the user's next trip destination.
 *
 * Two free endpoints are chained: geocoding (city name → lat/lon) then the
 * forecast API. All calls are best-effort — callers should treat a null return
 * as "no weather available" and render gracefully.
 */

export interface WeatherSummary {
  city: string;
  country: string;
  temperature: number;
  /** WMO weather interpretation code. */
  weatherCode: number;
  description: string;
  emoji: string;
  high: number;
  low: number;
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
}

// WMO weather interpretation codes → friendly label + emoji.
const WMO: Record<number, { label: string; emoji: string }> = {
  0: { label: "Clear sky", emoji: "☀️" },
  1: { label: "Mainly clear", emoji: "🌤️" },
  2: { label: "Partly cloudy", emoji: "⛅" },
  3: { label: "Overcast", emoji: "☁️" },
  45: { label: "Fog", emoji: "🌫️" },
  48: { label: "Rime fog", emoji: "🌫️" },
  51: { label: "Light drizzle", emoji: "🌦️" },
  53: { label: "Drizzle", emoji: "🌦️" },
  55: { label: "Heavy drizzle", emoji: "🌧️" },
  61: { label: "Light rain", emoji: "🌦️" },
  63: { label: "Rain", emoji: "🌧️" },
  65: { label: "Heavy rain", emoji: "🌧️" },
  71: { label: "Light snow", emoji: "🌨️" },
  73: { label: "Snow", emoji: "❄️" },
  75: { label: "Heavy snow", emoji: "❄️" },
  80: { label: "Rain showers", emoji: "🌦️" },
  81: { label: "Rain showers", emoji: "🌧️" },
  82: { label: "Heavy showers", emoji: "⛈️" },
  95: { label: "Thunderstorm", emoji: "⛈️" },
  96: { label: "Thunderstorm", emoji: "⛈️" },
  99: { label: "Thunderstorm", emoji: "⛈️" },
};

function describe(code: number): { label: string; emoji: string } {
  return WMO[code] ?? { label: "—", emoji: "🌍" };
}

async function geocode(city: string): Promise<GeocodeResult | null> {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=" +
    encodeURIComponent(city);
  const res = await fetch(url, { next: { revalidate: 86_400 } });
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: GeocodeResult[] };
  return json.results?.[0] ?? null;
}

/**
 * Fetch a compact weather summary for a city. Returns null on any failure.
 * Results are cached for an hour to keep the dashboard snappy and stay well
 * within Open-Meteo's free limits.
 */
export async function getWeather(
  city: string,
  fallbackCountry = ""
): Promise<WeatherSummary | null> {
  try {
    const place = await geocode(city);
    if (!place) return null;

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}` +
      `&longitude=${place.longitude}&current=temperature_2m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
    const res = await fetch(url, { next: { revalidate: 3_600 } });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      current?: { temperature_2m: number; weather_code: number };
      daily?: { temperature_2m_max: number[]; temperature_2m_min: number[] };
    };
    if (!json.current) return null;

    const code = json.current.weather_code;
    const { label, emoji } = describe(code);

    return {
      city: place.name,
      country: place.country || fallbackCountry,
      temperature: Math.round(json.current.temperature_2m),
      weatherCode: code,
      description: label,
      emoji,
      high: Math.round(
        json.daily?.temperature_2m_max?.[0] ?? json.current.temperature_2m
      ),
      low: Math.round(
        json.daily?.temperature_2m_min?.[0] ?? json.current.temperature_2m
      ),
    };
  } catch {
    return null;
  }
}
