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
    login/page.tsx              # /login — email+password + Google OAuth
    signup/page.tsx             # /signup — email+password + Google OAuth
    onboarding/page.tsx         # /onboarding — 3-step wizard (auth-guarded)
    onboarding/actions.ts       # saveOnboarding server action → user_profiles
    dashboard/page.tsx          # /dashboard — protected landing + sign out
    explore/page.tsx            # /explore — destination browser (search+filter)
    explore/[destination]/page.tsx  # /explore/:slug — destination detail (SSG)
    trip/[id]/page.tsx          # /trip/:id — created trip (protected)
    auth/callback/route.ts      # GET — OAuth/email code → session exchange
    api/
      places/
        autocomplete/route.ts        # POST — Places autocomplete proxy
        details/[placeId]/route.ts   # GET  — Place details proxy
  data/
    destinations.ts             # 16 seed destinations + helpers (Mood, etc.)
  middleware.ts                 # Session refresh + protected-route gate
  components/
    nav/
      Navbar.tsx                # Sticky top nav with mobile hamburger drawer
    layout/
      Footer.tsx                # Site footer (About, Blog, Help, Privacy)
    ui/
      Button.tsx                # Button component + buttonVariants helper
      Card.tsx                  # Card component (default / elevated / flat)
    auth/
      AuthForm.tsx              # Login/signup form (useFormState + server action)
      GoogleButton.tsx          # "Continue with Google" OAuth form button
      SubmitButton.tsx          # useFormStatus pending-aware submit button
      OnboardingWizard.tsx      # 3-step client wizard (no reloads)
      SignOutButton.tsx         # Sign-out form → signOut action
    search/
      SearchBar.tsx             # Combobox input (icon, spinner, Esc-to-clear)
      SearchResults.tsx         # Autocomplete dropdown (keyboard nav)
      DestinationCard.tsx       # Selected-place detail card + skeleton
  hooks/
    usePlacesSearch.ts          # Debounced (350ms) autocomplete fetch hook
  lib/
    utils.ts                    # cn() class-name helper
    auth/actions.ts             # signUp/signIn/signInWithGoogle/signOut actions
    supabase/
      client.ts                 # createBrowserClient (client components)
      server.ts                 # createServerClient (RSC/actions/handlers)
      middleware.ts             # updateSession() — cookie refresh + gate
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

## Authentication (Supabase Auth + SSR)

Auth uses **Supabase Auth** with the `@supabase/ssr` cookie-based session
helpers, so the session works across Server Components, Route Handlers,
Server Actions, and middleware.

### Environment

```bash
# .env.local (gitignored)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

The anon key is safe to expose to the browser (RLS enforces access). Run
`supabase/migrations/0001_user_profiles.sql` in the Supabase SQL editor to
create the `user_profiles` table + RLS policies. For Google OAuth, enable the
Google provider in Supabase and add `<origin>/auth/callback` as a redirect URL.

### Three Supabase clients

| File | Used in | Helper |
|------|---------|--------|
| `lib/supabase/client.ts` | Client Components | `createBrowserClient` |
| `lib/supabase/server.ts` | RSC / actions / handlers | `createServerClient` + `cookies()` |
| `lib/supabase/middleware.ts` | `middleware.ts` | `createServerClient` + request/response cookies |

### Flows

- **/signup** → `signUpWithEmail`. If email confirmation is off, a session is
  returned and the user is redirected to **/onboarding**; otherwise a
  "check your email" message is shown (the confirm link returns to
  `/auth/callback?next=/onboarding`).
- **/login** → `signInWithEmail`, then redirect to `returnTo` (if same-site)
  or **/dashboard**.
- **Google OAuth** (`signInWithGoogle`) → `signInWithOAuth` → provider →
  `/auth/callback?next=…` → `exchangeCodeForSession` → redirect. New users
  (signup) land on `/onboarding`, returning users on `/dashboard`/`returnTo`.
- **/onboarding** → 3-step client wizard (destination + dates → companions →
  budget slider). `saveOnboarding` upserts into `user_profiles`, then
  redirects to **/dashboard**.

### Route protection

`middleware.ts` runs on all non-asset paths: it refreshes the session cookie
site-wide (via `getUser()`) and redirects unauthenticated requests to any
`/dashboard`, `/trip`, or `/account` route to
`/login?returnTo=<original-path>`. `/onboarding` and `/dashboard` also guard
themselves server-side as defence-in-depth.

**Open-redirect safety**: `returnTo` / `next` are only honoured when they are
same-site relative paths (start with `/`, not `//`) — enforced in the login
page, `signInWithEmail`, `signInWithGoogle`, and the callback handler.

## Destination Explorer

`/explore` and `/explore/[destination]` are driven entirely by
`src/data/destinations.ts` (16 seed destinations) — no external API.

- **`/explore`** — server page passes `DESTINATIONS` to the `ExploreBrowser`
  client component, which does client-side search (name/country) + mood-pill
  filtering (All / Beach / City / Adventure / Culture / Budget) over a
  responsive card grid. Cards show image, name, country, mood tags, and best
  time to visit.
- **`/explore/[destination]`** — statically generated (`generateStaticParams`)
  for SEO/perf: hero, Quick Facts row, a free 3-day `ItineraryTimeline`
  (Morning/Afternoon/Evening), a locked 7-day `LockedItineraryCard`, and a
  `StartPlanningButton`.
- **Auth-aware locked card**: to keep the page static, `LockedItineraryCard`
  reads the session in the browser (`supabase.auth.getSession()`). Logged-out
  → sign-up modal (`/signup?returnTo=/explore/<slug>`); logged-in (free plan)
  → upgrade modal (`/pricing`). There is no Pro tier yet, so any signed-in
  user is treated as free.
- **Start planning**: `createTrip(slug)` server action — logged-out users are
  redirected to sign-up (returning to the destination); logged-in users get a
  row inserted into the `trips` table (migration `0002_trips.sql`, per-user
  RLS) and are redirected to `/trip/[id]` (a protected stub page).

## Trip Collaboration (Pro)

Trips can be shared with collaborators as **Viewer** or **Editor**. Schema +
RLS live in `supabase/migrations/0005_collaboration.sql`.

### Data model

- `trip_members` — every participant (owner included, added by an
  `after insert` trigger on `trips`). Columns: `trip_id`, `user_id`, `email`,
  `role` (`owner`/`editor`/`viewer`), `edit_requested`.
- `trip_invites` — `invited_email`, `role`, `status`
  (`pending`/`accepted`/`declined`), `token` (UUID for `/invite/[token]`),
  `invited_by`.
- `trips.user_id` stays the canonical owner. Ownership transfer swaps it.

### Roles & RLS

`SECURITY DEFINER` helpers avoid policy recursion: `is_trip_member`,
`trip_role`, `can_edit_trip`, `trip_id_for_day`. RLS: members can **view**
trips/days/activities; only editors+owner can **mutate** days/activities;
only the owner can update/delete the trip row. Invitee actions (`accept`,
`decline`, ownership `transfer`, anonymous `invite_details` preview) run
through `SECURITY DEFINER` RPCs.

### Server actions (`src/lib/trips/collaboration.ts`)

`inviteCollaborator`, `revokeInvite`, `acceptInvite`, `declineInvite`,
`changeMemberRole`, `removeMember`, `transferOwnership`, `requestEditAccess`.
Inviting is gated on the **owner** being Pro. Planner mutations in
`actions.ts` now authorize via `can_edit_trip` (editors, not just owner).

### Email (Resend)

`src/lib/email/resend.ts` POSTs to the Resend REST API — no SDK dependency.
Env (server-only, never `NEXT_PUBLIC_`):

```bash
RESEND_API_KEY=...                       # if unset, invites still create;
RESEND_FROM="Wanderly <onboarding@resend.dev>"  # the UI surfaces the link to copy
```

### Realtime

`useTripRealtime(tripId, onChange)` subscribes to `postgres_changes` on
`trip_days` (filtered by `trip_id`) and `activities` (RLS-scoped), debouncing a
`router.refresh()` so collaborators' edits appear live. The two tables are
added to the `supabase_realtime` publication in the migration.

### UI

- `/trip/[id]` top bar: `MemberAvatars` (initials) + a Share/Members button
  opening the `TripSettings` slide-over (invite form, member roles, pending
  invites, ownership transfer).
- Viewers get a read-only planner + a "Request edit access" button (sets
  `edit_requested`, surfaced to the owner in settings).
- `/invite/[token]`: public acceptance page — previews the invite, prompts
  sign-up/login when logged out, accept/decline when the email matches.
