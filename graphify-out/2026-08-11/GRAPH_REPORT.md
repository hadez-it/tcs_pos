# Graph Report - .  (2026-08-10)

## Corpus Check
- 42 files · ~60,411 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 322 nodes · 657 edges · 16 communities (12 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Thermal Barcode & Label Generation
- UI Modals & Authentication Components
- Cashier Dashboard & Navigation Flow
- Capacitor Mobile & UI Dependencies
- Build System & Dev Tools
- TypeScript Environment Configuration
- Native Bluetooth Printer Bridge
- Web Bluetooth Thermal Printer Integration
- Core Database Schema & System Architecture
- Web App PWA Manifest Configuration
- Vercel Deployment Configuration
- Graphify Knowledge Graph Configuration
- Capacitor Android Native Configuration
- Web HTML Entry Point
- Supabase Business Settings Schema

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
- `AuthProps` --references--> `UserProfile`  [EXTRACTED]
  src/components/Auth.tsx → src/types.ts
- `BarcodePrintModalProps` --references--> `Product`  [EXTRACTED]
  src/components/BarcodePrintModal.tsx → src/types.ts
- `CashierDashboardProps` --references--> `UserProfile`  [EXTRACTED]
  src/components/CashierDashboard.tsx → src/types.ts
- `CartItem` --references--> `Product`  [EXTRACTED]
  src/components/CashierDashboard.tsx → src/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Sales Transaction Processing Flow** — supabase_schema_sales, supabase_schema_sale_items, supabase_schema_inventory_transactions [EXTRACTED 1.00]
- **Multi-branch Architecture Data Models** — supabase_schema_branches, supabase_schema_products, supabase_schema_sales, supabase_schema_cash_flow [EXTRACTED 1.00]

## Communities (16 total, 4 thin omitted)

### Community 0 - "Thermal Barcode & Label Generation"
Cohesion: 0.10
Nodes (60): BARCODE_TYPES, BarcodePrintModal(), clamp(), parseMm(), BarcodeSVG(), BarcodeSVGProps, CODE39_PATTERNS, BARCODE_TYPES (+52 more)

### Community 1 - "UI Modals & Authentication Components"
Cohesion: 0.07
Nodes (40): Auth(), AuthProps, BarcodePrintModalProps, CartItem, CashierDashboardProps, CsvImportModal(), CsvImportModalProps, LabelGeneratorTabProps (+32 more)

### Community 2 - "Cashier Dashboard & Navigation Flow"
Cohesion: 0.09
Nodes (37): App(), ExitPrompt(), BarcodeScannerModal(), BarcodeScannerModalProps, CashierDashboard(), getQuickCashOptions(), HeldCart, OfflineSyncBar() (+29 more)

### Community 3 - "Capacitor Mobile & UI Dependencies"
Cohesion: 0.07
Nodes (29): @capacitor/android, @capacitor/app, @capacitor/cli, @capacitor/core, lucide-react, dependencies, @capacitor/android, @capacitor/app (+21 more)

### Community 4 - "Build System & Dev Tools"
Cohesion: 0.07
Nodes (26): autoprefixer, devDependencies, autoprefixer, tailwindcss, tsx, @types/node, @types/web-bluetooth, typescript (+18 more)

### Community 5 - "TypeScript Environment Configuration"
Cohesion: 0.08
Nodes (24): android, dist, DOM, DOM.Iterable, ES2022, node_modules, src/**/*, compilerOptions (+16 more)

### Community 6 - "Native Bluetooth Printer Bridge"
Cohesion: 0.23
Nodes (17): autoConnectLastPrinter(), bytesToLatin1(), connect(), disconnect(), getDeviceName(), getLastPrinter(), getPairedPrinters(), isBluetoothAvailable() (+9 more)

### Community 7 - "Web Bluetooth Thermal Printer Integration"
Cohesion: 0.17
Nodes (10): BluetoothPrinterState, connect(), disconnect(), DisconnectCallback, FALLBACK_SERVICES, handleDisconnect(), send(), sendWithProgress() (+2 more)

### Community 8 - "Core Database Schema & System Architecture"
Cohesion: 0.19
Nodes (13): Cashier Dashboard, Owner Dashboard, Mibayate POS System Architecture, Supabase Offline Fallback Rationale, Branches Table, Cash Flow Table, current_user_is_owner Function, handle_new_user Trigger (+5 more)

### Community 9 - "Web App PWA Manifest Configuration"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 10 - "Vercel Deployment Configuration"
Cohesion: 0.40
Nodes (4): buildCommand, framework, outputDirectory, rewrites

## Knowledge Gaps
- **109 isolated node(s):** `config`, `name`, `private`, `version`, `type` (+104 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Product` connect `UI Modals & Authentication Components` to `Thermal Barcode & Label Generation`, `Cashier Dashboard & Navigation Flow`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Capacitor Mobile & UI Dependencies` to `Build System & Dev Tools`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `config`, `name`, `private` to the rest of the system?**
  _109 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Thermal Barcode & Label Generation` be split into smaller, more focused modules?**
  _Cohesion score 0.09543193125282677 - nodes in this community are weakly interconnected._
- **Should `UI Modals & Authentication Components` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Should `Cashier Dashboard & Navigation Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.0851063829787234 - nodes in this community are weakly interconnected._
- **Should `Capacitor Mobile & UI Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._