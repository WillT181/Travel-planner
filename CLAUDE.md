# Travel Planner — Project Reference

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v3 |
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
  app/                        # Next.js App Router pages
    layout.tsx                # Root layout (Navbar + global styles)
    page.tsx                  # / — Home / landing page
    search/page.tsx           # /search — Destination search
    itinerary/page.tsx        # /itinerary — Itinerary builder
    itinerary/[id]/page.tsx   # /itinerary/:id — Trip detail view
    map/page.tsx              # /map — Map view
    trips/page.tsx            # /trips — Saved trips list
  components/
    nav/
      Navbar.tsx              # Persistent top navigation
  styles/
    globals.css               # Tailwind base + global resets
```

## Design System

### Colour Tokens (Tailwind)

| Role | Token | Hex |
|------|-------|-----|
| Primary | `primary-600` | `#2563eb` (blue) |
| Accent / CTA | `accent-500` | `#f97316` (orange) |
| Text default | `neutral-900` | `#0f172a` |
| Text muted | `neutral-500` | `#64748b` |
| Border | `neutral-200` | `#e2e8f0` |
| Surface | `neutral-50` | `#f8fafc` |

### Typography

- Base font: **Inter** (system-ui fallback)
- Body: 16px / line-height 1.5
- Headings: `font-bold tracking-tight`
- Type scale: 12 14 16 18 24 30 36 48 (Tailwind defaults)

## Conventions

- **Imports**: Use `@/*` alias for `src/*` — e.g. `import Navbar from "@/components/nav/Navbar"`.
- **Metadata**: Export `metadata` (or `generateMetadata`) from every page file.
- **Accessibility**: All interactive elements must have visible focus rings; minimum touch target 44×44px.
- **Components**: Co-locate component files under `src/components/<feature>/ComponentName.tsx`.
- **No default exports from config files** — use named exports for utilities and types; default exports for React components and Next.js pages/layouts only.
- **Tailwind only** — no inline styles or CSS Modules unless a strong reason exists.
