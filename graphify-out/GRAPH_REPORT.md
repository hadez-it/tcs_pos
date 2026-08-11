# Graph Report - mibayate_pos  (2026-08-11)

## Corpus Check
- 44 files · ~64,765 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 324 nodes · 681 edges · 17 communities (13 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6b8dddd4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- escpos.ts
- OwnerDashboard.tsx
- App.tsx
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
- SingleLabelModal.tsx

## God Nodes (most connected - your core abstractions)
1. `buildThermalLabel()` - 23 edges
2. `buildCustomThermalLabel()` - 16 edges
3. `Product` - 15 edges
4. `useToast()` - 15 edges
5. `compilerOptions` - 15 edges
6. `concat()` - 14 edges
7. `testPrint()` - 13 edges
8. `UserProfile` - 13 edges
9. `BarcodePrintModal()` - 12 edges
10. `LabelGeneratorTab()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Supabase Offline Fallback Rationale` --semantically_similar_to--> `Profiles Table`  [INFERRED] [semantically similar]
  AGENTS.md → supabase_schema.txt
- `CashierDashboardProps` --references--> `UserProfile`  [EXTRACTED]
  src/components/CashierDashboard.tsx → src/types.ts
- `ExitPrompt()` --calls--> `useToast()`  [EXTRACTED]
  src/App.tsx → src/utils/toast.tsx
- `AuthProps` --references--> `UserProfile`  [EXTRACTED]
  src/components/Auth.tsx → src/types.ts
- `BarcodePrintModalProps` --references--> `Product`  [EXTRACTED]
  src/components/BarcodePrintModal.tsx → src/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Sales Transaction Processing Flow** — supabase_schema_sales, supabase_schema_sale_items, supabase_schema_inventory_transactions [EXTRACTED 1.00]
- **Multi-branch Architecture Data Models** — supabase_schema_branches, supabase_schema_products, supabase_schema_sales, supabase_schema_cash_flow [EXTRACTED 1.00]

## Communities (17 total, 4 thin omitted)

### Community 0 - "escpos.ts"
Cohesion: 0.15
Nodes (35): loadAssignedName(), PrinterRole, PrinterSettings(), PrinterSettingsProps, saveAssignedName(), absoluteTextLines(), Align, barcode() (+27 more)

### Community 1 - "OwnerDashboard.tsx"
Cohesion: 0.08
Nodes (42): Auth(), AuthProps, CsvImportModal(), DeleteRequestsTab(), DeleteRequestsTabProps, OfflineSyncBar(), OwnerDashboard(), OwnerDashboardProps (+34 more)

### Community 2 - "App.tsx"
Cohesion: 0.10
Nodes (31): App(), ExitPrompt(), BarcodeScannerModal(), BarcodeScannerModalProps, CashierDashboard(), CashierDashboardProps, getQuickCashOptions(), HeldCart (+23 more)

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

### Community 16 - "SingleLabelModal.tsx"
Cohesion: 0.15
Nodes (30): BarcodePrintModal(), BarcodePrintModalProps, clamp(), parseMm(), BarcodeSVG(), BarcodeSVGProps, CODE128_PATTERNS, CartItem (+22 more)

## Knowledge Gaps
- **107 isolated node(s):** `config`, `name`, `private`, `version`, `type` (+102 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Product` connect `SingleLabelModal.tsx` to `OwnerDashboard.tsx`, `App.tsx`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `buildThermalLabel()` connect `escpos.ts` to `SingleLabelModal.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `config`, `name`, `private` to the rest of the system?**
  _107 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `escpos.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14714714714714713 - nodes in this community are weakly interconnected._
- **Should `OwnerDashboard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07578084997439836 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09986504723346828 - nodes in this community are weakly interconnected._