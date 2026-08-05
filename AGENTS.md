# AGENTS.md

Guidance for AI coding agents working in this repository: a web-based point-of-sale
(POS) system for a Myanmar retail business (MiBayate), built with React + TypeScript
+ Vite, backed by Supabase with an offline LocalStorage fallback.

## Project Overview

- Frontend-only SPA. All data access goes through a service layer in
  `src/lib/supabase.ts` (`dbService`), which talks to Supabase when configured and
  transparently falls back to `localStorage` mock stores when offline/not configured.
- No backend server. `src/data/schemaSql.ts` holds the full Supabase DDL (also in
  `/supabase_schema.sql`, mirrored by `supabase_schema.txt`); migrations live in
  `supabase_migrations/`.
- Roles: `owner` (full dashboard) and `cashier` (POS checkout). See `src/App.tsx`.
- UI: inline Tailwind utility classes, `lucide-react` icons, `recharts` for charts,
  Material-style Android layout with a bottom nav bar. Reserve the
  `frontend-design` skill for any new UI work.

## Commands

- Install: `npm install` (a `bun.lock` also exists; `bun` may be used on some setups)
- Dev server: `npm run dev` (Vite on port 3000, `--host`, `--port=3000`)
- Build: `npm run build` (`vite build`)
- Preview: `npm run preview`
- Lint / typecheck: `npm run lint` which runs `tsc --noEmit`
- Clean: `npm run clean` (removes `dist`)
- **Tests**: none. There is no test runner configured (no Vitest/Jest/Playwright).
  Do not write or assume tests exist. To verify changes, run `npm run lint`
  (`tsc --noEmit`) and `npm run build`.

## Layout / Key Files

- `src/lib/supabase.ts` — the data-access service (`dbService`), Supabase client +
  LocalStorage fallback (offline). All DB logic, id/SKU/barcode generation lives here.
- `src/types.ts` — shared TypeScript types (Product, Sale, CashierProfile, Transaction,
  CashFlowEntry, Branch, BusinessProfile, etc.).
- `src/lib/escpos.ts`, `src/lib/bluetoothPrinter.ts` — thermal/bluetooth printing.
- `src/components/` — one file per surface/modal: `OwnerDashboard.tsx`, `CashierDashboard.tsx`,
  `CsvImportModal.tsx`, `QuickRestockModal.tsx`, `BarcodePrintModal.tsx`, `Auth.tsx`, etc.
- `src/utils/format.ts` — currency/number formatting.
- `src/utils/toast.tsx` — toast notifications (`useToast`).
- `src/lib/backNavigation.ts` — Android-like back gesture handling.

## Commands You Must NOT run

- Do not intentionally commit files containing secrets (`.env`, credentials).
- Do not change git config (`git config user.*`) — the repo has no local identity set;
  pass identity per-commit with `-c user.name=... -c user.email=...` only if needed,
  matching prior commits (e.g. `raven-app1 <app.ravenz@gmail.com>`).

## Code Style & Conventions

- **Components**: functional components with hooks; default-export the main
  component and also `export const Name` (matching existing pattern). Props typed via
  an `interface XxxProps`.
- **File name** = PascalCase for components (`.tsx`), camelCase for util libs (`.ts`).
- **State naming**: `useState` with descriptive names; a `showXxxModal` boolean plus an
  `editingXxx`/selected entity object; a `xxxForm` object for form state; `isXxxing`
  guards for double-submit; `xxxError`/`xxxSuccess` strings for inline messages.
- **Error handling**: wrap async ops in `try/catch`, surface via `toast(msg, 'error')`
  and local error state. Supabase calls usually fall back to LocalStorage on failure
  (see `dbService` helpers `getMockData` / `saveMockData`). Log via `console.warn/error`.
- **Never add comments** unless the surrounding code has them (this codebase does use
  section comments like `// ------------------` and `/** ... */` for services — match the
  surrounding style, but avoid gratuitous line comments).
- **Currency/numbers**: parse user numeric input with `parseFloat/parseInt(trimmed)`
  and coerce with `|| 0`; format display with `formatCurrency`.
- **Identifiers**: camelCase for variables/functions; PascalCase for types/components.
- **Imports**: group third-party, then lucide icons, then local relative imports.
  Use specific named icon imports from `lucide-react`. Use `@/` path or relative paths —
  both are configured; prefer relative for same-folder components.
- **Styling**: Tailwind utility classes inline; existing color scheme is indigo
  (primary/actions), emerald (success/money/stock-in), red (danger/delete),
  amber (warnings/low stock). Keep mobile-first (`sm:` breakpoints) with a `hidden sm:block`
  desktop table next to a mobile card list where lists are shown two ways.
- **Types**: define interfaces in `src/types.ts`; do not invent ad-hoc shapes in
  components where a shared type exists. Prefer `Partial<Product>` for partial inputs.

## Data / Error Handling Notes

- Products have both `id` (uuid-ish) plus `sku` and `barcode`; generation must avoid
  collisions — see `dbService.products.generateCodes()` and `collectProductCodes()`.
- SKUs in DB are uppercase-normalized; barcodes are normalized via `normalizeBarcode`.
- Never reuse imported CSV identifiers (see recent commit history: each imported row gets
  a brand-new id/sku/barcode). Be careful when touching `bulkImport`.
- Stock mutations must log an `inventory_transactions` row (`stock-in`/`stock-out`/`sale`);
  keep the `CashFlowEntry`/COGS derivation in sync (see `cashFlowLedger`).

## State / local values notes

- HMR must stay designed with `vite.config.ts` as-is (DISABLE_HMR-conditional watch);
  do not modify that watch logic.
- The UI has a `select-none overflow-hidden` layout and Android-safe-area classes
  (`safe-area-top/bottom`); preserve these when editing the shell in `OwnerDashboard`.

## Known pre-existing issues (do not treat as your fault)

`npm run lint` (`tsc --noEmit`) currently reports unrelated errors in
`src/lib/bluetoothPrinter.ts` (missing Web Bluetooth types) and `src/lib/escpos.ts`
 (barcode enum) plus `src/lib/supabase.ts` region. These are pre-existing and block a
100% clean typecheck; do not "fix" them unless the user asks, and do not claim the code
you add introduced them. Verify your own changes by confirming no *new* errors appear.