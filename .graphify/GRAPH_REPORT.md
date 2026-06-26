# Graph Report - .  (2026-06-25)

## Corpus Check
- Corpus is ~20,549 words - fits in a single context window. You may not need a graph.

## Summary
- 210 nodes · 440 edges · 12 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 154 · calls: 102 · imports: 54 · MODIFIES: 53 · imports_from: 27 · ON_BRANCH: 20 · PARENT_OF: 19 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 30 · Candidates: 43
- Excluded: 0 untracked · 28853 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `992401d`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `positiveAmount()` - 17 edges
2. `normalizeState()` - 12 edges
3. `asNumber()` - 9 edges
4. `baseSettingsBalance()` - 9 edges
5. `calculatedUsedCreditBalance()` - 9 edges
6. `applyTransactionToState()` - 9 edges
7. `isStaleSeededUsedBalance()` - 8 edges
8. `materializeDueRecurringTransactions()` - 8 edges
9. `calculateCardDebtFor()` - 8 edges
10. `fetch()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `11bd0ef Use explicit credit used balance` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 0 → community 2_
- `12bd41c Add ponytail and graphify dependencies` --PARENT_OF--> `2a63dcc Add card debt tracking and finance docs`  [EXTRACTED]
  git → git  _Bridges community 2 → community 5_
- `3a6b2b9 Correct card used balance calculation` --PARENT_OF--> `b893545 Fix recurring item editing`  [EXTRACTED]
  git → git  _Bridges community 5 → community 0_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (48): 11bd0ef Use explicit credit used balance, 16c9b6b Add transaction editing and recurring automation, 992401d Fix used credit balance migration, a7f53c4 Fix credit balance and local date handling, b893545 Fix recurring item editing, cb49078 Track card payments in used balance, addDays(), almostEqual() (+40 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (15): lucide-react, recharts, ConfirmConfig, emptyRecurring, FinancialInsight, GuidedTourStep, guidedTourSteps, GuideTopic (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (20): main, sync_state, 1107313 Migrate PWA to React Vite, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 4e52d92 Fix mobile menu scroll lock, 54e9dd9 Add guided app tour, 64f025e Add dynamic user guide (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (8): worker.ts, db, FakeD1, FakeKV, FakeStatement, kv, payload, secret

### Community 4 - "Community 4"
Cohesion: 0.27
Nodes (13): base64ToBytes(), bytesToBase64(), bytesToHex(), decryptStateFromSync(), deriveEncryptionKey(), EncryptedPayload, encryptStateForSync(), fetchSync() (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (12): 2a63dcc Add card debt tracking and finance docs, 3a6b2b9 Correct card used balance calculation, CalculatedPeriod, CardCalendarEntry, CardDebtSummary, PaymentScheduleItem, Period, RecurringItem (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (9): applyServiceWorkerUpdate(), checkForServiceWorkerUpdate(), getServiceWorkerRegistration(), hasWaitingWorker(), PwaUpdateStatus, registerServiceWorker(), RegisterServiceWorkerOptions, waitForInstallingWorker() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (7): cloneSeed(), seedState, today, loadState(), openDb(), saveState(), AppState

### Community 8 - "Community 8"
Cohesion: 0.44
Nodes (8): CORS_HEADERS, corsHeaders(), fetch(), getState(), json(), putState(), readJson(), validateSyncId()

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (6): react-dom/client, styles.css, react, App(), buildFinancialInsights(), formatPercent()

### Community 10 - "Community 10"
Cohesion: 0.43
Nodes (6): downloadText(), exportMonthlyCsv(), exportStateJson(), readJsonFile(), toCsv(), MonthlyReport

### Community 11 - "Community 11"
Cohesion: 1.00
Nodes (2): pwaStatusText(), SettingsView()

## Knowledge Gaps
- **37 isolated node(s):** `sync_state`, `APP_SHELL`, `Toast`, `InsightTone`, `FinancialInsight` (+32 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 11`** (2 nodes): `pwaStatusText()`, `SettingsView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalizeState()` connect `Community 0` to `Community 7`, `Community 4`, `Community 1`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `sync_state`, `APP_SHELL`, `Toast` to the rest of the system?**
  _37 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09276018099547512 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12923076923076923 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._