# Graph Report - mibayate_pos  (2026-08-17)

## Corpus Check
- 115 files · ~92,029 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 693 nodes · 1373 edges · 54 communities (41 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `16888acd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Branch
- App.tsx
- escpos.ts
- compress.py
- dependencies
- devDependencies
- compilerOptions
- validate.py
- bluetoothPrinter.ts
- Branches Table
- manifest.json
- vercel.json
- Graphify Rule
- capacitor.config.ts
- Application Web Entry Point
- Business Settings Table
- caveman-compress/README.md
- cavecrew/SKILL.md
- Caveman Help
- Caveman Compress
- caveman/SKILL.md
- caveman-commit
- caveman-explore/package.json
- caveman-learn/package.json
- caveman-review
- Review Caveman evidence
- Manage eval-gated experiments
- caveman-setup/SKILL.md
- Evaluate an optimization observation
- caveman-stats
- caveman-discover/SKILL.md
- public/skills/caveman-learn — the Caveman Learn editing skill (MIT, public)
- caveman-learn skill
- caveman-explore/tests/skill-file.test.mjs
- __init__.py
- caveman-learn/tests/skill-file.test.mjs
- investigate-first/SKILL.md
- lean-build/SKILL.md
- migration/SKILL.md
- safe-refactor/SKILL.md
- surgical-patch/SKILL.md
- verify-and-stop/SKILL.md
- realtimeSync.ts
- CashierDashboard.tsx
- supabase.ts
- SaleWithItems
- CashierSalesHistory.tsx
- types.ts
- OwnerDashboard.tsx

## God Nodes (most connected - your core abstractions)
1. `UserProfile` - 35 edges
2. `LabelGeneratorTab()` - 25 edges
3. `Branch` - 25 edges
4. `formatCurrency()` - 25 edges
5. `SingleLabelModal()` - 24 edges
6. `buildThermalLabel()` - 23 edges
7. `Product` - 23 edges
8. `BarcodePrintModal()` - 22 edges
9. `PrinterSettings()` - 20 edges
10. `useToast()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Supabase Offline Fallback Rationale` --semantically_similar_to--> `Profiles Table`  [INFERRED] [semantically similar]
  AGENTS.md → supabase_schema.txt
- `CashierDashboardProps` --references--> `UserProfile`  [EXTRACTED]
  src/components/CashierDashboard.tsx → src/types.ts
- `CashiersTabProps` --references--> `UserProfile`  [EXTRACTED]
  src/components/dashboard/CashiersTab.tsx → src/types.ts
- `compress_file()` --calls--> `validate()`  [EXTRACTED]
  .agents/skills/caveman-compress/scripts/compress.py → .agents/skills/caveman-compress/scripts/validate.py
- `ExitPrompt()` --calls--> `useToast()`  [EXTRACTED]
  src/App.tsx → src/utils/toast.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Multi-branch Architecture Data Models** — supabase_schema_branches, supabase_schema_products, supabase_schema_sales, supabase_schema_cash_flow [EXTRACTED 1.00]
- **Sales Transaction Processing Flow** — supabase_schema_sales, supabase_schema_sale_items, supabase_schema_inventory_transactions [EXTRACTED 1.00]

## Communities (54 total, 13 thin omitted)

### Community 0 - "Branch"
Cohesion: 0.10
Nodes (22): BarcodePrintModalProps, CartItem, CsvImportModal(), CsvImportModalProps, BranchesTabProps, ProductsTab(), ProductsTabProps, DeleteRequestsTabProps (+14 more)

### Community 1 - "App.tsx"
Cohesion: 0.08
Nodes (34): App(), ExitPrompt(), OfflineSyncBar(), PullToRefresh(), PullToRefreshProps, SetupBanner(), SUPABASE_SCHEMA_SQL, depthState() (+26 more)

### Community 2 - "escpos.ts"
Cohesion: 0.09
Nodes (76): BarcodePrintModal(), clamp(), parseMm(), BarcodeSVG(), BarcodeSVGProps, CODE128_PATTERNS, clamp(), LabelGeneratorTab() (+68 more)

### Community 3 - "compress.py"
Cohesion: 0.10
Nodes (33): main(), print_usage(), backup_dir_for(), build_compress_prompt(), build_fix_prompt(), call_claude(), compress_file(), first_nonblank_line() (+25 more)

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (39): @capacitor/android, @capacitor/app, @capacitor/cli, @capacitor/core, @hookform/resolvers, lucide-react, dependencies, @capacitor/android (+31 more)

### Community 5 - "devDependencies"
Cohesion: 0.05
Nodes (37): autoprefixer, jsdom, devDependencies, autoprefixer, jsdom, tailwindcss, @testing-library/jest-dom, @testing-library/react (+29 more)

### Community 6 - "compilerOptions"
Cohesion: 0.08
Nodes (24): android, dist, DOM, DOM.Iterable, ES2022, node_modules, src/**/*, compilerOptions (+16 more)

### Community 7 - "validate.py"
Cohesion: 0.13
Nodes (23): benchmark_pair(), count_tokens(), main(), print_table(), Path, count_bullets(), extract_code_blocks(), extract_headings() (+15 more)

### Community 8 - "bluetoothPrinter.ts"
Cohesion: 0.17
Nodes (10): BluetoothPrinterState, connect(), disconnect(), DisconnectCallback, FALLBACK_SERVICES, handleDisconnect(), send(), sendWithProgress() (+2 more)

### Community 9 - "Branches Table"
Cohesion: 0.19
Nodes (13): Cashier Dashboard, Owner Dashboard, Mibayate POS System Architecture, Supabase Offline Fallback Rationale, Branches Table, Cash Flow Table, current_user_is_owner Function, handle_new_user Trigger (+5 more)

### Community 10 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 11 - "vercel.json"
Cohesion: 0.40
Nodes (4): buildCommand, framework, outputDirectory, rewrites

### Community 17 - "caveman-compress/README.md"
Cohesion: 0.09
Nodes (20): Before / After, Benchmarks, How It Work, <img src="../../docs/assets/dancing-rock.svg" width="20" height="20" alt="rock"/> Caveman (285 tokens), Install, 📄 Original (706 tokens), Part of Caveman, Security (+12 more)

### Community 18 - "cavecrew/SKILL.md"
Cohesion: 0.14
Nodes (12): cavecrew, Example chaining, How to invoke, Model overrides, See also, What it does, Auto-clarity (inherited), Chaining patterns (+4 more)

### Community 19 - "Caveman Help"
Cohesion: 0.14
Nodes (12): caveman-help, Example output, How to invoke, See also, What it does, Caveman Help, Configure Default Mode, Deactivate (+4 more)

### Community 20 - "Caveman Compress"
Cohesion: 0.17
Nodes (11): Boundaries, Caveman Compress, Compress, Compression Rules, Pattern, Preserve EXACTLY (never modify), Preserve Structure, Process (+3 more)

### Community 21 - "caveman/SKILL.md"
Cohesion: 0.17
Nodes (10): caveman, Example output, How to invoke, See also, What it does, Auto-Clarity, Boundaries, Intensity (+2 more)

### Community 22 - "caveman-commit"
Cohesion: 0.18
Nodes (9): caveman-commit, Example output, How to invoke, See also, What it does, Auto-Clarity, Boundaries, Examples (+1 more)

### Community 23 - "caveman-explore/package.json"
Cohesion: 0.18
Nodes (10): description, files, SKILL.md, license, name, private, scripts, test (+2 more)

### Community 24 - "caveman-learn/package.json"
Cohesion: 0.18
Nodes (10): description, files, SKILL.md, license, name, private, scripts, test (+2 more)

### Community 25 - "caveman-review"
Cohesion: 0.18
Nodes (9): caveman-review, Example output, How to invoke, See also, What it does, Auto-Clarity, Boundaries, Examples (+1 more)

### Community 26 - "Review Caveman evidence"
Cohesion: 0.25
Nodes (7): Hard rules, Review Caveman evidence, Step 1 — Load context, Step 2 — Establish baseline, Step 3 — Test the leading explanation with traces, Step 4 — Inspect representative traces, Step 5 — Report

### Community 27 - "Manage eval-gated experiments"
Cohesion: 0.25
Nodes (7): Manage eval-gated experiments, Non-negotiable gates, Step 1 — Load project and experiment, Step 2 — Evaluate evidence, Step 3 — Propose one action, Step 4 — Block unsafe execution, Step 5 — Re-read after external operator action

### Community 28 - "caveman-setup/SKILL.md"
Cohesion: 0.25
Nodes (7): Failure templates (use verbatim, filled in — never soften), Rules (non-negotiable), Step 1 — Find every live LLM callsite, Step 2 — Pick the app slug, Step 3 — Wire each callsite, Step 4 — Verify with one real request, Step 5 — Report

### Community 29 - "Evaluate an optimization observation"
Cohesion: 0.29
Nodes (6): 1. Read the exact observations, 2. Ask the operator to choose, 3. Design a candidate and paired eval, 4. Apply only the approved candidate, 5. Report observations, not savings, Evaluate an optimization observation

### Community 30 - "caveman-stats"
Cohesion: 0.29
Nodes (5): caveman-stats, Example output, How to invoke, See also, What it does

### Community 31 - "caveman-discover/SKILL.md"
Cohesion: 0.33
Nodes (5): Step 1 — Inventory the workflows, Step 2 — Name them, Step 3 — Propose, then apply, Step 4 — Verify, Step 5 — Report

### Community 32 - "public/skills/caveman-learn — the Caveman Learn editing skill (MIT, public)"
Cohesion: 0.40
Nodes (4): Boundary (binding), Install path, Layout, public/skills/caveman-learn — the Caveman Learn editing skill (MIT, public)

### Community 33 - "caveman-learn skill"
Cohesion: 0.40
Nodes (4): caveman-learn skill, Honesty, Install, What it does

### Community 47 - "realtimeSync.ts"
Cohesion: 0.31
Nodes (13): handleCustomDataChange(), handleOnline(), handleVisibilityOrFocus(), listeners, notifyDataChanged(), notifyListeners(), setupRealtimeChannel(), startSyncEngine() (+5 more)

### Community 48 - "CashierDashboard.tsx"
Cohesion: 0.18
Nodes (20): BarcodeScannerModal(), BarcodeScannerModalProps, CashierDashboard(), CashierDashboardProps, getQuickCashOptions(), HeldCart, DeleteRequestsTab(), OwnerDashboard() (+12 more)

### Community 49 - "supabase.ts"
Cohesion: 0.15
Nodes (15): Auth(), AuthProps, ChangePasswordTab(), ChangePasswordTabProps, TransactionsTabProps, CashierModal(), CashierModalProps, OwnerDashboardProps (+7 more)

### Community 50 - "SaleWithItems"
Cohesion: 0.18
Nodes (13): OverviewTab(), OverviewTabProps, SalesAnalytics, StaffPerformanceTab(), StaffPerformanceTabProps, FilterDrawer(), FilterDrawerProps, SaleReportTabProps (+5 more)

### Community 51 - "CashierSalesHistory.tsx"
Cohesion: 0.18
Nodes (12): CashierSalesHistory(), CashierSalesHistoryProps, DatePreset, PaymentFilter, SortOption, StatusFilter, ViewMode, PosStore (+4 more)

### Community 52 - "types.ts"
Cohesion: 0.20
Nodes (12): CashFlowTab(), CashFlowTabProps, CashFlowModal(), CashFlowModalProps, EXPENSE_CATEGORIES, INCOME_CATEGORIES, CashFlowEntry, CashFlowType (+4 more)

### Community 53 - "OwnerDashboard.tsx"
Cohesion: 0.35
Nodes (8): BranchesTab(), CashiersTab(), CashiersTabProps, TransactionsTab(), dbService, usePosStore, InventoryTransaction, formatDisplayEmail()

## Knowledge Gaps
- **271 isolated node(s):** `name`, `version`, `license`, `private`, `type` (+266 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `UserProfile` connect `supabase.ts` to `Branch`, `App.tsx`, `CashierDashboard.tsx`, `SaleWithItems`, `CashierSalesHistory.tsx`, `types.ts`, `OwnerDashboard.tsx`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `Product` connect `Branch` to `escpos.ts`, `CashierDashboard.tsx`, `supabase.ts`, `SaleWithItems`, `CashierSalesHistory.tsx`, `types.ts`, `OwnerDashboard.tsx`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `name`, `version`, `license` to the rest of the system?**
  _271 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Branch` be split into smaller, more focused modules?**
  _Cohesion score 0.10256410256410256 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0753045404208195 - nodes in this community are weakly interconnected._
- **Should `escpos.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08548479632816983 - nodes in this community are weakly interconnected._