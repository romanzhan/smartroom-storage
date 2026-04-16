# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev          # Vite dev server on localhost:3000
npm run build        # Production build to /dist/ (base: /smartroom-storage/)
npm run build:wp     # WordPress build to /dist/ (base: ./ — relative paths)
npm run preview      # Preview built site
npm run test         # Vitest single run
npm run test:watch   # Vitest watch mode
npm run deploy       # Build + deploy to gh-pages

# Run a single test file
npx vitest run src/js/calculator/store.test.js
```

Requires Node >=18.

Tests are co-located as `*.test.js` next to source files. Vitest config is in `vitest.config.js` (separate from vite.config.js), environment: `node`, pattern: `src/**/*.test.js`.

Google Maps API key: set `VITE_GOOGLE_MAPS_API_KEY` in `.env` (dev) or hardcode in `src/js/calculator/inline-maps-api-key.js` (prod/gh-pages).

GSAP is loaded via CDN at runtime (not bundled) — it must be available as a global. WordPress pages include it via `wp_enqueue_script`; the dev `index.html` loads it via `<script>` tag.

## Architecture

Vanilla JS multi-step storage calculator with Vite bundler. No framework — DOM-first modules with a centralized store.

Vite root is `src/`, path alias `@` → `src/js/`. Production base path is `/smartroom-storage/` (for gh-pages); dev uses `/`.

### Entry flow

`src/js/main.js` → loads site config (4-layer merge) → `initCalculator(config)` → `initCalculatorModules()` (creates all modules) → `attachCalculatorFlow()` (wires step transitions).

### State management: Store + Snapshot

`src/js/calculator/store.js` is the single source of truth:
- `store.modules` — holds references to all initialized modules
- `store.currentTab` ("boxes" | "furniture"), `store.currentStep` (1-4)
- `store.notify()` → calls `getSnapshot()` → broadcasts to all subscribers
- `getSnapshot()` recomputes all derived data (prices, totals, bookingDetails) from module state on every call

Modules never talk to each other directly. They call `onChange()` → `store.notify()` → sidebar and other subscribers re-render from the new snapshot.

### Module factory pattern

Each module in `src/js/calculator/` follows:
```js
export function initModuleName({ container, onChange, ...config }) {
  // internal state, DOM event listeners
  return { getData(), ...publicAPI };
}
```
Modules are wired in `modules-init.js`. The `getData()` return value is consumed by `store.getSnapshot()`.

### 4-layer site config

`src/js/site-config/load-site-config.js` merges (lowest → highest priority):
1. `defaults.js` hardcoded defaults
2. `public/calculator-config.json` (fetched at runtime)
3. `localStorage[smartroom_site_config]`
4. `window.__SMARTROOM_SITE_CONFIG__` (WordPress injection)

`merge-layers.js` deep-merges nested objects (`collection`, `vat`, `extras`) and clones arrays (`items`, `allowedPostcodes`). All pricing constants live in `defaults.js` under `collection.*` and `vat.*` — designed for future admin panel editing.

### Collection fee calculation

`calculateCollectionFee()` in `store.js` implements a time-based formula from the moving calculator:
- Loading time = efficiency(movers) x volume(m3) x floorMultiplier(pickup)
- Unloading time = efficiency(movers) x volume(m3) x 1.0 (warehouse = ground)
- Travel time = miles x 3 + 85 (London delay)
- Base price = totalMinutes / 60 x moverRate
- Then: overload surcharge → urgency/weekend/holiday/timeSlot surcharges → extras → VAT

Small jobs (<2 m3) use fixed loading/unloading times and minimum price £65. Movers auto-selected by volume (1 if <=10m3, 2 if >10m3).

### Multi-step wizard

`src/js/calculator/flow.js` manages step transitions with validation:
- Step 1: Items/units + insurance (mandatory)
- Step 2: Delivery mode (collection vs drop-off) + address/facility + extras (furniture+collection only)
- Step 3: Date + time slot
- Step 4: Contact details + checkout

Each step validates before advancing. GSAP handles animations and scroll-to-error.

### Build & entry points

Vite has multiple entry points: `src/index.html` (main), `src/admin.html`, `src/wp.html`, `src/payment-success.html`. Build output uses stable filenames (no content hashes) for predictable WordPress asset URLs.

CSS uses PostCSS with PurgeCSS in production to strip unused styles.

### HTML templating

Vite uses a custom Handlebars plugin (`plugins/handlebars.js`). Main page is `src/index.html` with `{{> calculator}}` pulling from `src/partials/calculator.html`.

### Google Maps integration

- `postcode.js` — autocomplete + place resolution orchestrator
- `google-places.js` — Places API New client (autocomplete, details, distance)
- `maps-driving.js` — Maps JS SDK distance matrix (avoids REST CORS)
- `maps-api-guard.js` — 60s sliding window rate limiter per tab
- `places-cache.js` — 30-day localStorage + 10-min memory cache

## Key files

| File | Role |
|------|------|
| `store.js` | State, snapshot computation, collection fee formula |
| `modules-init.js` | Wires all modules together |
| `flow.js` | Step transitions, validation, modals |
| `defaults.js` | All configurable constants (prices, rates, thresholds) |
| `data.js` | Furniture units catalog (with volumes) |
| `sidebar.js` | Price summary rendering |
| `extras.js` | Add-on services (shown for furniture+collection only) |
| `address.js` | Address input, property type/floor selection, delivery mode toggle |
| `postcode.js` | Google Places autocomplete + place resolution orchestrator |
| `src/js/lib/runtime-utils.js` | Date validation, notifications, GSAP animation helpers |

## WordPress integration

See `wp_integration.md` for embedding via PHP plugin. Config injected as `window.__SMARTROOM_SITE_CONFIG__` in wp_head. GSAP loaded via CDN (not bundled).
