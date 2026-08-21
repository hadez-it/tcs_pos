# AGENTS.md

## Project

TCS POS — a React 19 + Vite + Tailwind v4 retail point-of-sale system. Targets web (Vercel) and Android (Capacitor). Dual dashboard: Owner (analytics, products, branches, cash flow) and Cashier (cart, checkout, receipts).

## Commands

```bash
npm run dev          # Vite dev server on :3000
npm run build        # Production build to dist/
npm run lint         # tsc --noEmit (typecheck only — no separate test runner)
npm run cap:android  # Build + Capacitor sync for Android
npm run cap:open     # Open Android Studio
```

There is **no test suite** — `npm run lint` is the only verification. Run it after any change.

## Architecture

- `src/main.tsx` → `src/App.tsx` → routes by role to `OwnerDashboard.tsx` or `CashierDashboard.tsx`
- `src/lib/supabase.ts` — data layer. Falls back to LocalStorage when Supabase env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are absent. Always check `isSupabaseConfigured` before assuming remote.
- `src/lib/backNavigation.ts` — hardware back button + tab history stack. Modals use `useBackDismiss(isOpen, onClose)`.
- `src/lib/escpos.ts` + `printerBridge.ts` + `bluetoothPrinter.ts` — thermal printer support (ESC/POS labels via native SPP or Web Bluetooth).
- `src/components/` — all UI. `OwnerDashboard.tsx` is the largest file (~4700 lines).
- `src/types.ts` — single source of truth for all interfaces.
- `supabase_migrations/` — SQL migrations for Supabase backend.

## Conventions

- **No code comments** — do not add them. Existing comments (if any) are legacy; match the surrounding comment-free style.
- **Monochrome UI** — black, white, and grays only. Red is reserved exclusively for errors (validation, delete actions, error toasts). No other colors (no indigo/emerald/amber/etc.).
- **Tailwind v4** — uses `@import "tailwindcss"` (no tailwind.config.js). Custom theme tokens in `src/index.css` under `@theme`.
- **Icons** — `lucide-react` only. No other icon libraries.
- **Charts** — `recharts` (`ResponsiveContainer`, `LineChart`, etc.).
- **Currency** — `formatCurrency()` in `src/utils/format.ts` returns `"<n> Ks"` (Myanmar Kyat). `BusinessProfile.currency` overrides symbol.
- **Supabase offline** — when unconfigured, all CRUD goes to LocalStorage under keys like `retail_shop_*`. Test both paths if touching data logic.

## Build notes

- `vite.config.ts` sets `base: './'` for Capacitor compatibility.
- `index.html` has `body { position: fixed; overflow: hidden }` for Android WebView.
- HMR is disabled via `DISABLE_HMR=true` env var in AI Studio to prevent flickering during agent edits. Do not re-enable.
- Android package: `com.mibayate.pos`.

## Gotchas

- `BarcodePrintModal` reads `BusinessProfile.name` for the store header — pass it as `businessName` prop.
- `npm run lint` IS the typecheck. There is no separate `typecheck` or `test` script.
- Capacitor SPP bluetooth plugin needs `https://localhost` origin (configured in `capacitor.config.ts` via `allowMixedContent`).
