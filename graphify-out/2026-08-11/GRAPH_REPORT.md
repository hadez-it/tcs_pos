# Graph Report - mibayate_pos  (2026-08-11)

## Corpus Check
- 40 files · ~59,921 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 321 nodes · 656 edges · 17 communities (13 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3d2927a8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- escpos.ts
- OwnerDashboard.tsx
- CashierDashboard.tsx
- dependencies
- scripts
- compilerOptions
- printerBridge.ts
- bluetoothPrinter.ts
- Branches Table
- manifest.json
- vercel.json
- Graphify Rule
- capacitor.config.ts
- Application Web Entry Point
- Business Settings Table
- Product

## God Nodes (most connected - your core abstractions)
1. `buildThermalLabel()` - 23 edges
2. `buildCustomThermalLabel()` - 16 edges
3. `Product` - 15 edges
4. `compilerOptions` - 15 edges
5. `concat()` - 14 edges
6. `testPrint()` - 13 edges
7. `useToast()` - 13 edges
8. `LabelGeneratorTab()` - 12 edges
9. `SingleLabelModal()` - 12 edges
10. `setCodePage()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Supabase Offline Fallback Rationale` --semantically_similar_to--> `Profiles Table`  [INFERRED] [semantically similar]
  AGENTS.md → supabase_schema.txt
- `ExitPrompt()` --calls--> `useToast()`  [EXTRACTED]
  src/App.tsx → src/utils/toast.tsx
- `App()` --calls--> `startBackNavigation()`  [EXTRACTED]
  src/App.tsx → src/lib/backNavigation.ts
- `App()` --calls--> `stopBackNavigation()`  [EXTRACTED]
  src/App.tsx → src/lib/backNavigation.ts
- `AuthProps` --references--> `UserProfile`  [EXTRACTED]
  src/components/Auth.tsx → src/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Sales Transaction Processing Flow** — supabase_schema_sales, supabase_schema_sale_items, supabase_schema_inventory_transactions [EXTRACTED 1.00]
- **Multi-branch Architecture Data Models** — supabase_schema_branches, supabase_schema_products, supabase_schema_sales, supabase_schema_cash_flow [EXTRACTED 1.00]

## Communities (17 total, 4 thin omitted)

### Community 0 - "escpos.ts"
Cohesion: 0.10
Nodes (60): BARCODE_TYPES, BarcodePrintModal(), clamp(), parseMm(), BarcodeSVG(), BarcodeSVGProps, CODE39_PATTERNS, BARCODE_TYPES (+52 more)

### Community 1 - "OwnerDashboard.tsx"
Cohesion: 0.08
Nodes (37): App(), ExitPrompt(), Auth(), AuthProps, CashierDashboardProps, OfflineSyncBar(), OwnerDashboardProps, PullToRefresh() (+29 more)

### Community 2 - "CashierDashboard.tsx"
Cohesion: 0.16
Nodes (21): BarcodeScannerModal(), BarcodeScannerModalProps, CashierDashboard(), getQuickCashOptions(), HeldCart, CategoryOption, SearchableCategorySelect(), SearchableCategorySelectProps (+13 more)

### Community 3 - "dependencies"
Cohesion: 0.07
Nodes (29): @capacitor/android, @capacitor/app, @capacitor/cli, @capacitor/core, lucide-react, dependencies, @capacitor/android, @capacitor/app (+21 more)

### Community 4 - "scripts"
Cohesion: 0.07
Nodes (26): autoprefixer, devDependencies, autoprefixer, tailwindcss, tsx, @types/node, @types/web-bluetooth, typescript (+18 more)

### Community 5 - "compilerOptions"
Cohesion: 0.08
Nodes (24): android, dist, DOM, DOM.Iterable, ES2022, node_modules, src/**/*, compilerOptions (+16 more)

### Community 6 - "printerBridge.ts"
Cohesion: 0.23
Nodes (17): autoConnectLastPrinter(), bytesToLatin1(), connect(), disconnect(), getDeviceName(), getLastPrinter(), getPairedPrinters(), isBluetoothAvailable() (+9 more)

### Community 7 - "bluetoothPrinter.ts"
Cohesion: 0.17
Nodes (10): BluetoothPrinterState, connect(), disconnect(), DisconnectCallback, FALLBACK_SERVICES, handleDisconnect(), send(), sendWithProgress() (+2 more)

### Community 8 - "Branches Table"
Cohesion: 0.19
Nodes (13): Cashier Dashboard, Owner Dashboard, Mibayate POS System Architecture, Supabase Offline Fallback Rationale, Branches Table, Cash Flow Table, current_user_is_owner Function, handle_new_user Trigger (+5 more)

### Community 9 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 10 - "vercel.json"
Cohesion: 0.40
Nodes (4): buildCommand, framework, outputDirectory, rewrites

### Community 16 - "Product"
Cohesion: 0.11
Nodes (18): BarcodePrintModalProps, CartItem, CsvImportModal(), CsvImportModalProps, LabelGeneratorTabProps, OwnerDashboard(), QuickRestockModal(), QuickRestockModalProps (+10 more)

## Knowledge Gaps
- **108 isolated node(s):** `config`, `name`, `private`, `version`, `type` (+103 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Product` connect `Product` to `escpos.ts`, `OwnerDashboard.tsx`, `CashierDashboard.tsx`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `config`, `name`, `private` to the rest of the system?**
  _108 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `escpos.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09543193125282677 - nodes in this community are weakly interconnected._
- **Should `OwnerDashboard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08200290275761973 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._