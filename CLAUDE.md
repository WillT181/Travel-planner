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
    search/page.tsx             # /search — Destination search
    itinerary/page.tsx          # /itinerary — Itinerary builder
    itinerary/[id]/page.tsx     # /itinerary/:id — Trip detail view
    map/page.tsx                # /map — Map view
    trips/page.tsx              # /trips — Saved trips list
  components/
    nav/
      Navbar.tsx                # Sticky top nav with mobile hamburger drawer
    layout/
      Footer.tsx                # Site footer (About, Blog, Help, Privacy)
    ui/
      Button.tsx                # Button component + buttonVariants helper
      Card.tsx                  # Card component (default / elevated / flat)
  lib/
    utils.ts                    # cn() class-name helper
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
