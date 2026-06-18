import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { getAllGuides, type GuideMeta } from "@/lib/guides";
import GuidesBrowser from "@/components/guides/GuidesBrowser";

export const metadata: Metadata = {
  title: "Travel guides for 50 countries",
  description:
    "Free in-depth travel guides for 50 of the world's best destinations — visa info, best time to visit, where to go, what to eat, and sample itineraries.",
  openGraph: {
    title: "Travel guides for 50 countries — Wanderly",
    description:
      "Free in-depth travel guides covering visa rules, seasons, budgets, itineraries, and more for Europe, Asia, the Americas, Africa, and Oceania.",
    type: "website",
  },
};

const REGION_ORDER = ["Europe", "Asia", "Americas", "Africa", "Oceania"];

interface RegionGroup {
  region: string;
  guides: GuideMeta[];
}

function buildGroups(guides: GuideMeta[]): RegionGroup[] {
  // Load countries.json for region lookup
  const countriesPath = path.join(
    process.cwd(),
    "src/data/destinations/countries.json"
  );
  const top50Path = path.join(process.cwd(), "scripts/guides/top50.json");

  if (!fs.existsSync(countriesPath) || !fs.existsSync(top50Path)) {
    return [{ region: "All guides", guides }];
  }

  const countries = JSON.parse(fs.readFileSync(countriesPath, "utf8")) as {
    id: string;
    region: string;
    slug: string;
  }[];
  const top50 = JSON.parse(fs.readFileSync(top50Path, "utf8")) as {
    id: string;
    slug: string;
  }[];

  const regionById = Object.fromEntries(countries.map((c) => [c.id, c.region]));
  const idBySlug = Object.fromEntries(top50.map((e) => [e.slug, e.id]));

  const byRegion: Record<string, GuideMeta[]> = {};
  for (const guide of guides) {
    const id = idBySlug[guide.slug];
    const region = (id && regionById[id]) ?? "Other";
    (byRegion[region] ??= []).push(guide);
  }

  const ordered: RegionGroup[] = REGION_ORDER.filter((r) => byRegion[r]).map(
    (r) => ({
      region: r,
      guides: byRegion[r].sort((a, b) => a.country.localeCompare(b.country)),
    })
  );

  // Any regions not in the ordered list go at the end
  for (const [region, g] of Object.entries(byRegion)) {
    if (!REGION_ORDER.includes(region)) {
      ordered.push({
        region,
        guides: g.sort((a, b) => a.country.localeCompare(b.country)),
      });
    }
  }

  return ordered;
}

export default function GuidesIndexPage() {
  const guides = getAllGuides();
  const groups = buildGroups(guides);
  const total = guides.length;

  return (
    <div className="py-8">
      {/* Header */}
      <header className="mb-10 max-w-2xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary-600">
          Destination guides
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Travel guides for 50 countries
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-neutral-600">
          In-depth, practical guides covering visa requirements, best time to
          visit, where to go, local food, culture tips, and day-by-day sample
          itineraries — for {total} of the world&apos;s top destinations.
        </p>
      </header>

      {/* Stats strip */}
      <div className="mb-10 grid grid-cols-2 gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:grid-cols-4">
        {[
          { value: `${total}`, label: "Country guides" },
          { value: "5", label: "Regions covered" },
          { value: "11", label: "Sections per guide" },
          { value: "Free", label: "No paywall" },
        ].map(({ value, label }) => (
          <div key={label} className="text-center">
            <p className="text-2xl font-bold text-primary-600">{value}</p>
            <p className="mt-0.5 text-sm text-neutral-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Client browser (search + grouped grids) */}
      <GuidesBrowser groups={groups} totalCount={total} />
    </div>
  );
}
