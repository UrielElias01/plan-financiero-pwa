# Graph Report - .  (2026-07-01)

## Corpus Check
- Corpus is ~22,891 words - fits in a single context window. You may not need a graph.

## Summary
- 251 nodes · 550 edges · 17 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 187 · calls: 124 · MODIFIES: 78 · imports: 68 · imports_from: 29 · ON_BRANCH: 27 · PARENT_OF: 26 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 31 · Candidates: 44
- Excluded: 0 untracked · 28905 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `9ecb141`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `positiveAmount()` - 20 edges
2. `normalizeState()` - 14 edges
3. `asNumber()` - 12 edges
4. `applyTransactionToState()` - 10 edges
5. `baseSettingsBalance()` - 9 edges
6. `calculatedUsedCreditBalance()` - 9 edges
7. `isStaleSeededUsedBalance()` - 8 edges
8. `materializeDueRecurringTransactions()` - 8 edges
9. `calculateCardDebtFor()` - 8 edges
10. `fetch()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `11bd0ef Use explicit credit used balance` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 6 → community 1_
- `11bd0ef Use explicit credit used balance` --PARENT_OF--> `a7f53c4 Fix credit balance and local date handling`  [EXTRACTED]
  git → git  _Bridges community 6 → community 2_
- `16c9b6b Add transaction editing and recurring automation` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 2 → community 1_
- `7b7c39e Anchor savings to first open period` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 3 → community 1_
- `applyTransactionToPeriods()` --calls--> `asNumber()`  [EXTRACTED]
  pwa-finanzas/src/lib/calculations.ts → pwa-finanzas/src/lib/calculations.ts  _Bridges community 2 → community 12_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (15): lucide-react, recharts, ConfirmConfig, emptyRecurring, FinancialInsight, GuidedTourStep, guidedTourSteps, GuideTopic (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (24): main, sync_state, 1107313 Migrate PWA to React Vite, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 4e52d92 Fix mobile menu scroll lock, 54e9dd9 Add guided app tour, 64f025e Add dynamic user guide (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (19): 16c9b6b Add transaction editing and recurring automation, 992401d Fix used credit balance migration, a7f53c4 Fix credit balance and local date handling, cb49078 Track card payments in used balance, applyTransactionToPeriods(), buildRecurringEffects(), calculateMonthlyFor(), calculatePeriodsFor() (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (20): 7b7c39e Anchor savings to first open period, 9ecb141 Lock closed periods from edits, eb403b7 Show base period closing with settings fallback, duePayrollPeriodsFor(), calculated, closedTransaction, due, foodPeriod (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (8): worker.ts, db, FakeD1, FakeKV, FakeStatement, kv, payload, secret

### Community 5 - "Community 5"
Cohesion: 0.25
Nodes (18): almostEqual(), applyTransactionToState(), baseSettingsBalance(), calculateCardDebtFor(), calculatedUsedCreditBalance(), cardPaymentsByPeriod(), cardPaymentTransactionsThrough(), creditActivityThrough() (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (14): 11bd0ef Use explicit credit used balance, 2a63dcc Add card debt tracking and finance docs, 3a6b2b9 Correct card used balance calculation, b893545 Fix recurring item editing, CalculatedPeriod, CardCalendarEntry, CardDebtSummary, PaymentScheduleItem (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (13): base64ToBytes(), bytesToBase64(), bytesToHex(), decryptStateFromSync(), deriveEncryptionKey(), EncryptedPayload, encryptStateForSync(), fetchSync() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (11): addDays(), buildPaymentScheduleFor(), dateForDay(), localId(), materializeDueRecurringTransactions(), padDatePart(), paydayForPeriod(), periodIdFor() (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (9): applyServiceWorkerUpdate(), checkForServiceWorkerUpdate(), getServiceWorkerRegistration(), hasWaitingWorker(), PwaUpdateStatus, registerServiceWorker(), RegisterServiceWorkerOptions, waitForInstallingWorker() (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (7): cloneSeed(), seedState, today, loadState(), openDb(), saveState(), AppState

### Community 11 - "Community 11"
Cohesion: 0.44
Nodes (8): CORS_HEADERS, corsHeaders(), fetch(), getState(), json(), putState(), readJson(), validateSyncId()

### Community 12 - "Community 12"
Cohesion: 0.31
Nodes (9): asNumber(), closePeriodFor(), closingIncomeFor(), closingPreviewFor(), closingRentReserveFor(), formatMoney(), PeriodDateParts, reopenPeriodFor() (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (6): react-dom/client, styles.css, react, App(), buildFinancialInsights(), formatPercent()

### Community 14 - "Community 14"
Cohesion: 0.43
Nodes (6): downloadText(), exportMonthlyCsv(), exportStateJson(), readJsonFile(), toCsv(), MonthlyReport

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (4): buildNextPeriodFor(), estimatedPeriodFor(), nextPeriodParts(), periodLabelFor()

### Community 16 - "Community 16"
Cohesion: 1.00
Nodes (2): pwaStatusText(), SettingsView()

## Knowledge Gaps
- **54 isolated node(s):** `sync_state`, `APP_SHELL`, `Toast`, `InsightTone`, `FinancialInsight` (+49 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 16`** (2 nodes): `pwaStatusText()`, `SettingsView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalizeState()` connect `Community 5` to `Community 2`, `Community 10`, `Community 7`, `Community 0`, `Community 3`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `sync_state`, `APP_SHELL`, `Toast` to the rest of the system?**
  _54 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11724137931034483 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12648221343873517 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.10476190476190476 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._