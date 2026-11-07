# Colony

Everyone has a role. Each one is vital.

Colony is a mobile PWA that helps people who earn save money on home services, while a curated home-service marketplace scales to manage many homes. A few households pool one budget. Direct funds pay the people who come on a normal basis (cooking, cleaning, laundry, shopping, plants). Whatever is left rolls into a pool that funds the specialists Colony matches you with (plumber, handyman, exterminator, seamstress). Colony takes nothing from the budget and never touches tips or bonuses.

This is the first build: a high-fidelity, fully interactive prototype with a seeded demo colony. State lives in the browser. The Supabase schema and Stripe edge functions are designed under `supabase/` and are not wired yet.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints on a phone-sized viewport. Tap "Tour Dekalb & Bergen" to load the demo colony, or "Start your own colony" to walk the onboarding. The invite code `HIVE-4821` joins the demo colony from the onboarding screen.

Demo controls live under You: advance a month (closes the month, rolls leftover into the pool, writes next month's schedule), reset the demo, and a hidden time-travel control (tap the version number five times).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | Strict TypeScript, no emit |
| `npm test` | Vitest unit tests for the engine, seed, store |
| `npm run build` | Typecheck, then a production build with the service worker and manifest in `dist/` |
| `npm run preview` | Serve `dist/` on port 4173 |
| `npm run test:e2e` | Playwright smoke test at iPhone size, screenshots in `e2e-out/` |
| `npm run icons` | Re-render the icon set from `public/favicon.svg` (the colony ring) |
| `npm run lint:dash` | Fails on any em dash or en dash in `src` |
| `npm run check` | the em dash lint, typecheck, test, build |

Playwright uses the Chromium that ships with `@playwright/test@1.63`. If your browsers live elsewhere, set `PLAYWRIGHT_BROWSERS_PATH`.

## Deploy

**Vercel (recommended).** Create a project from this repository and set Root Directory to `colony`. The framework preset is Vite, base path `/`. `vercel.json` carries the SPA rewrite and `no-cache` headers for the service worker and manifest.

**GitHub Pages subpath (optional).** Build with `VITE_BASE=/Collide/colony/ npm run build` and publish `dist/` at that path. Note that Collide's own service worker owns the `/Collide/` scope, so its navigation fallback must deny `/Collide/colony/` or installed Collide users will get the Collide shell.

## How it is put together

```
src/
  domain/   pure engine: dates, money, cadence, schedule, budget, match, membership, copy
  seed/     the demo colony: people, providers, 28 meals, service catalog, seasonal prep
  store/    tiny external store, actions, selectors, StoreProvider
  data/     ColonyRepo seam: LocalRepo (now), SupabaseRepo and billing stubs (later)
  system/   the design system: tokens, type, base, every component, the motion grammar, the /system library
  shell/    app frame (one main scroller, the route switch, tab bar, hosts), update toast, install row
  screens/  Welcome, Start, Home, Budget, Needs, Colony, You, Membership, provider/*
  sheets/   bottom sheets, grouped by subject
supabase/
  schema.sql                 tables, RLS helpers, billing, pool_balance()
  functions/                 colony-billing, colony-stripe-webhook, colony-match
tests/
  unit/                      Vitest
  e2e/                       Playwright smoke
```

Money is integer cents. Dates are `YYYY-MM-DD` strings. The engine is pure and unit tested; screens only derive from state.

### The design system

Every screen and sheet is composed from `src/system` (imported as `@/system`): tokens only, no raw colors, radii, fonts or durations outside `src/system/tokens.css`. The fonts are Geist, Geist Mono and Cardo from Google Fonts, reached through the token names `--font-sans`, `--font-mono` and `--font-serif`; nothing names a font family directly.

The `/system` route is the living library: every component and variant, searchable (`/system?q=notice`), with a Dark switch that flips only the specimens. It is linked from You under Demo as "System library".

Dark mode is `data-mode="dark"` on `<html>`, set before first paint by the inline script in `index.html` from `localStorage["colony.mode"]` or the OS preference. The tokens mirror under that attribute; no component names a dark color. Welcome is always dark (its root carries `data-mode="dark"`, its card `data-mode="light"`).

`npm run check` starts with `lint:dash`, which greps `src` for U+2013 and U+2014 and fails on a hit. Use a comma, a period, a colon or parentheses instead.

### The budget engine

- Contributions are the sum of each member's monthly amount (default $1,000 a person).
- Direct allocations are each engagement's cost times its occurrences in the month.
- Leftover is contributions minus direct. When the month closes, a positive leftover rolls into the pool. A negative leftover is flagged and never rolled.
- The pool funds accepted smart matches. `canFund` tells you what the catalog can cover now and what is a few months out.

### Smart match

`suggest(need, state)` scores every provider on skill fit, distance from their base to the home, availability inside the urgency window, whether the pool can cover the quote, and trust (rating, brought in by a member, already serves a colony home). It is deterministic, so the demo tells the same story every time.

## Wiring Supabase later

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Deploy the functions with the commands in each file's header and set the secrets listed there (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_COLONY`, `APP_URL`, `BILLING_CRON_SECRET`).
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `makeRepo()` in `src/data/supabaseRepo.ts` returns a `SupabaseRepo` when both are present. Writes move from `store/actions.ts` into edge function calls.

## Voice

Short, warm, first person plural. No em dashes anywhere, in copy, comments, SQL or commits.
