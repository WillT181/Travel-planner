import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import fs from "fs";
import path from "path";
import {
  getGuide,
  extractHeadings,
  getNearbyGuides,
  type GuideMeta,
} from "@/lib/guides";
import TableOfContents from "./TableOfContents";

// ─── static params ─────────────────────────────────────────────────────────

export function generateStaticParams() {
  const top50Path = path.join(process.cwd(), "scripts/guides/top50.json");
  if (!fs.existsSync(top50Path)) return [];
  const top50 = JSON.parse(fs.readFileSync(top50Path, "utf8")) as {
    slug: string;
  }[];
  return top50.map((e) => ({ slug: e.slug }));
}

// ─── metadata ──────────────────────────────────────────────────────────────

const BASE_URL = "https://wanderly.travel";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const guide = getGuide(params.slug);
  if (!guide) return { title: "Guide not found" };

  const ogUrl = new URL("/api/og/guide", BASE_URL);
  ogUrl.searchParams.set("country", guide.country);

  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `${BASE_URL}/guides/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      type: "article",
      url: `${BASE_URL}/guides/${guide.slug}`,
      modifiedTime: guide.lastUpdated,
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${guide.country} Travel Guide`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
      images: [ogUrl.toString()],
    },
  };
}

// ─── MDX component overrides ───────────────────────────────────────────────

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const mdxComponents = {
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const id = slugify(String(children));
    return (
      <h2
        id={id}
        className="mt-12 scroll-mt-24 text-2xl font-bold tracking-tight text-neutral-900 first:mt-0"
        {...props}
      >
        {children}
      </h2>
    );
  },
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-8 text-xl font-semibold text-neutral-900" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mt-4 leading-relaxed text-neutral-700" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className="mt-4 list-disc space-y-1.5 pl-6 text-neutral-700"
      {...props}
    />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className="mt-4 list-decimal space-y-1.5 pl-6 text-neutral-700"
      {...props}
    />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-relaxed" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="my-6 border-l-4 border-primary-500 pl-5 italic text-neutral-600"
      {...props}
    />
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200">
      <table
        className="min-w-full divide-y divide-neutral-200 text-sm"
        {...props}
      />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-neutral-50" {...props} />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
      {...props}
    />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="px-4 py-3 text-neutral-700" {...props} />
  ),
  tr: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="even:bg-neutral-50/50" {...props} />
  ),
  a: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const isInternal = href?.startsWith("/");
    if (isInternal) {
      return (
        <Link
          href={href!}
          className="font-medium text-primary-700 underline underline-offset-2 hover:text-primary-900"
          {...props}
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        className="font-medium text-primary-700 underline underline-offset-2 hover:text-primary-900"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  },
  hr: () => <hr className="my-10 border-neutral-200" />,
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-neutral-900" {...props} />
  ),
};

// ─── sub-components ────────────────────────────────────────────────────────

function QuickFactsCard({
  facts,
  country,
}: {
  facts: GuideMeta["quickFacts"];
  country: string;
}) {
  const rows = [
    facts.capital && { label: "Capital", value: facts.capital },
    facts.currency && { label: "Currency", value: facts.currency },
    facts.language && { label: "Language", value: facts.language },
    facts.bestMonths && { label: "Best time", value: facts.bestMonths },
    facts.budgetPerDay != null && {
      label: "Budget/day",
      value: `~$${facts.budgetPerDay} USD`,
    },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
        Quick facts · {country}
      </h2>
      <dl className="space-y-2.5">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-sm text-neutral-500">{label}</dt>
            <dd className="text-right text-sm font-medium text-neutral-900">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {facts.visaSummary && (
        <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50 px-3 py-2.5 text-xs text-primary-800">
          <span className="font-semibold">Visa: </span>
          {facts.visaSummary}
        </div>
      )}
    </div>
  );
}

function CTABlock({
  country,
  slug,
  variant = "mid",
}: {
  country: string;
  slug: string;
  variant?: "mid" | "end";
}) {
  return (
    <div className="my-12 overflow-hidden rounded-2xl bg-primary-600 px-8 py-8 text-white shadow-lg">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xl font-bold leading-tight">
            {variant === "end"
              ? `Ready to explore ${country}?`
              : `Plan your ${country} trip`}
          </p>
          <p className="mt-1 text-primary-100">
            {variant === "end"
              ? "Build a personalised day-by-day itinerary — free, no credit card needed."
              : "Create a free itinerary with day-by-day planning, budgets, and maps."}
          </p>
        </div>
        <Link
          href={`/signup?destination=${encodeURIComponent(slug)}`}
          className="shrink-0 rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary-700 shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
        >
          Start planning — free →
        </Link>
      </div>
    </div>
  );
}

function NearbyDestinations({ nearby }: { nearby: GuideMeta[] }) {
  if (nearby.length === 0) return null;

  return (
    <section className="mt-16 border-t border-neutral-200 pt-12">
      <h2 className="mb-6 text-xl font-bold tracking-tight text-neutral-900">
        Nearby destinations
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {nearby.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://picsum.photos/seed/${g.slug}/400/240`}
              alt={g.country}
              className="aspect-[5/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="p-3">
              <p className="text-sm font-semibold text-neutral-900">
                {g.country}
              </p>
              {g.quickFacts.bestMonths && (
                <p className="mt-0.5 text-xs text-neutral-500">
                  {g.quickFacts.bestMonths}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────

// Split MDX content at the h2 immediately after section 8 (Itineraries).
// Section 9 is "Food & Drink" — insert a mid-guide CTA just before it.
const SPLIT_MARKER = "## Food & Drink";

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  const headings = extractHeadings(guide.content);
  const nearby = getNearbyGuides(guide.slug);

  const splitAt = guide.content.indexOf(SPLIT_MARKER);
  const part1 = splitAt > -1 ? guide.content.slice(0, splitAt) : guide.content;
  const part2 = splitAt > -1 ? guide.content.slice(splitAt) : "";

  const heroImage =
    guide.heroImage || `https://picsum.photos/seed/${guide.slug}-hero/1600/640`;

  return (
    <>
      {/* ── Breadcrumb ── */}
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 text-sm text-neutral-500"
      >
        <Link href="/guides" className="hover:text-neutral-800">
          Travel guides
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-neutral-900">{guide.country}</span>
      </nav>

      {/* ── Hero ── */}
      <div className="relative mb-10 h-64 overflow-hidden rounded-3xl sm:h-80 lg:h-96">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImage}
          alt={guide.country}
          className="h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow sm:text-4xl lg:text-5xl">
            {guide.country} Travel Guide
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">
            {guide.description}
          </p>
          {guide.lastUpdated && (
            <p className="mt-3 text-xs text-white/60">
              Updated{" "}
              {new Date(guide.lastUpdated).toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </div>

      {/* ── Content grid ── */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_284px]">
        {/* ── Article ── */}
        <article className="min-w-0">
          <MDXRemote source={part1} components={mdxComponents} />

          {part2 && (
            <>
              <CTABlock
                country={guide.country}
                slug={guide.slug}
                variant="mid"
              />
              <MDXRemote source={part2} components={mdxComponents} />
            </>
          )}

          <CTABlock country={guide.country} slug={guide.slug} variant="end" />
        </article>

        {/* ── Sticky sidebar ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <QuickFactsCard facts={guide.quickFacts} country={guide.country} />
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <TableOfContents headings={headings} />
            </div>
            {/* Mini CTA in sidebar */}
            <div className="rounded-2xl bg-primary-50 p-5 text-center">
              <p className="text-sm font-semibold text-primary-900">
                Ready to plan?
              </p>
              <p className="mt-1 text-xs text-primary-700">
                Free itinerary builder — no card needed.
              </p>
              <Link
                href={`/signup?destination=${encodeURIComponent(guide.slug)}`}
                className="mt-3 inline-block rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700"
              >
                Start free →
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Nearby destinations ── */}
      <NearbyDestinations nearby={nearby} />
    </>
  );
}
