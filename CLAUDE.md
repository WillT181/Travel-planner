# Travel Planner — Project Reference

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v3 (CSS-variable colour tokens) |
| Linting | ESLint 8 + eslint-config-next |
| Formatting | Prettier |

## Commands

```bash
npm run dev      # start dev server on :3000
npm run build    # production build
npm run lint     # ESLint check
```

## Folder Structure

```
src/
  app/                          # Next.js App Router pages
    layout.tsx                  # Root layout (Navbar + Footer + Inter font)
    page.tsx                    # / — Home / landing page
    search/page.tsx             # /search — Destination search (client)
    itinerary/page.tsx          # /itinerary — Itinerary builder
    itinerary/[id]/page.tsx     # /itinerary/:id — Trip detail view
    map/page.tsx                # /map — Map view
    trips/page.tsx              # /trips — Saved trips list
    api/
      places/
        autocomplete/route.ts        # POST — Places autocomplete proxy
        details/[placeId]/route.ts   # GET  — Place details proxy
  components/
    nav/
      Navbar.tsx                # Sticky top nav with mobile hamburger drawer
    layout/
      Footer.tsx                # Site footer (About, Blog, Help, Privacy)
    ui/
      Button.tsx                # Button component + buttonVariants helper
      Card.tsx                  # Card component (default / elevated / flat)
    search/
      SearchBar.tsx             # Combobox input (icon, spinner, Esc-to-clear)
      SearchResults.tsx         # Autocomplete dropdown (keyboard nav)
      DestinationCard.tsx       # Selected-place detail card + skeleton
  hooks/
    usePlacesSearch.ts          # Debounced (350ms) autocomplete fetch hook
  lib/
    utils.ts                    # cn() class-name helper
  types/
    places.ts                   # AutocompleteResult, PlaceDetails, PlacesApiError
  styles/
    globals.css                 # Tailwind base, CSS variable colour tokens
```

## Design System

### Colour Tokens

Colours are defined as CSS custom properties in `globals.css` (space-separated
RGB channels) and referenced in `tailwind.config.ts` using the
`rgb(var(--token) / <alpha-value>)` pattern. This allows Tailwind's opacity
modifier syntax (`bg-primary-600/50`) to work correctly.

| Role | Token | Hex |
|------|-------|-----|
| Primary | `primary-600` | `#0d9488` (teal) |
| Primary dark | `primary-700` | `#0f766e` |
| Primary surface | `primary-50` | `#f0fdfa` |
| Accent / CTA | `accent-500` | `#f59e0b` (amber) |
| Accent dark | `accent-600` | `#d97706` |
| Text default | `neutral-900` | `#0f172a` |
| Text muted | `neutral-500` | `#64748b` |
| Border | `neutral-200` | `#e2e8f0` |
| Surface | `neutral-50` | `#f8fafc` |

To change the whole palette, edit the `:root` block in `globals.css`; no
component code needs to change.

### Typography

- Base font: **Inter** via `next/font/google` (variable: `--font-inter`)
- Body: 16px / line-height 1.6
- Headings: `font-bold tracking-tight`
- Type scale: 12 14 16 18 24 30 36 48 (Tailwind defaults)

### Components

#### Button (`src/components/ui/Button.tsx`)

```tsx
import Button, { buttonVariants } from "@/components/ui/Button";

// As a button element
<Button variant="primary" size="md">Save trip</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost">Learn more</Button>
<Button variant="danger">Delete</Button>

// As a styled Link (use buttonVariants helper)
<Link href="/itinerary" className={buttonVariants({ variant: "primary" })}>
  Plan for free
</Link>
```

Variants: `primary` | `secondary` | `ghost` | `danger`
Sizes: `sm` | `md` | `lg`

#### Card (`src/components/ui/Card.tsx`)

```tsx
import Card from "@/components/ui/Card";

<Card variant="default" padding="md">…</Card>
<Card variant="elevated" padding="lg">…</Card>
<Card variant="flat" padding="sm">…</Card>
```

Variants: `default` | `elevated` | `flat`
Padding: `none` | `sm` | `md` | `lg`

### Navigation

`Navbar.tsx` is a client component. It uses:
- `usePathname` to highlight the active link with `aria-current="page"`
- `useState` + CSS transforms for the slide-in mobile drawer
- `useEffect` to close the drawer on route change, Escape key, and body-scroll lock

## Conventions

- **Imports**: Use `@/*` alias for `src/*` — e.g. `import Card from "@/components/ui/Card"`.
- **Metadata**: Export `metadata` (or `generateMetadata`) from every page file.
- **Accessibility**: Visible focus rings on all interactive elements; min touch target 44×44 px; `aria-current="page"` on active nav items.
- **Components**: Co-locate under `src/components/<feature>/ComponentName.tsx`.
- **No default exports from config files** — named exports for utilities/types; default exports for React components and Next.js pages/layouts only.
- **Tailwind only** — no inline styles or CSS Modules unless a strong reason exists.
- **buttonVariants** — use this helper (not raw class strings) whenever you need button styles on a non-button element (Link, anchor).

## Google Places API Integration

The destination search feature proxies the **Google Places API (New)**
through server-side route handlers so the key is never bundled into client
JS and FieldMasks stay controlled in one place.

### Environment

```bash
# .env.local (gitignored — never commit a real key)
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=...
```

> Note: the key name carries the `NEXT_PUBLIC_` prefix as mandated by the
> task spec, but it is **only read inside the `/api/places/*` route handlers**
> (`process.env` on the server). Client code never references it. If you later
> drop the photo-proxy approach, rename it without the prefix to keep it fully
> private. The Place Photo URL is the one place the key is embedded in a
> client-fetched URL (Google's media endpoint requires `key=` as a query param).

### Routes

| Route | Method | Body / Param | Returns |
|-------|--------|--------------|---------|
| `/api/places/autocomplete` | POST | `{ input: string }` | `AutocompleteResult[]` |
| `/api/places/details/[placeId]` | GET | `placeId` path param | `PlaceDetails` |

Both return a `PlacesApiError` (`{ error, code }`) on failure. Error `code`s:
`MISSING_API_KEY`, `INVALID_REQUEST`, `UPSTREAM_ERROR`, `NOT_FOUND`,
`NETWORK_ERROR`, `UNKNOWN`. Upstream `403` (bad/unauthorised key) is mapped to
HTTP `401` + `MISSING_API_KEY`; other upstream failures map to `502`.

### Client data flow

1. `usePlacesSearch(query)` debounces input 350 ms, aborts stale requests, and
   returns `{ results, isLoading, error, clearResults }`. Empty input makes no
   call.
2. `search/page.tsx` owns selection state, keyboard navigation (↑/↓/Enter),
   and outside-click close; on select it fetches details and renders
   `DestinationCard` (skeleton → detail → error-with-retry).
3. "Start Planning" links to `/itinerary/new?destination={placeId}` (the
   itinerary builder is a later step — that route is not built yet).

### FieldMasks

- Autocomplete: `suggestions.placePrediction.{placeId,text,structuredFormat}`
- Details: `id,displayName,formattedAddress,location,photos,rating,userRatingCount,editorialSummary,types`

Keep FieldMasks minimal — Google bills Place Details by the field categories
requested.
