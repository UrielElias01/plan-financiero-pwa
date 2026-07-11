# Graph Report - .  (2026-07-11)

## Corpus Check
- Corpus is ~22,198 words - fits in a single context window. You may not need a graph.

## Summary
- 292 nodes · 639 edges · 12 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 222 · calls: 144 · MODIFIES: 93 · imports: 75 · ON_BRANCH: 33 · PARENT_OF: 32 · imports_from: 29 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 31 · Candidates: 44
- Excluded: 0 untracked · 28922 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `e1015a8`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `positiveAmount()` - 22 edges
2. `normalizeState()` - 18 edges
3. `asNumber()` - 15 edges
4. `applyTransactionToState()` - 13 edges
5. `materializeDueRecurringTransactions()` - 10 edges
6. `baseSettingsBalance()` - 9 edges
7. `calculatedUsedCreditBalance()` - 9 edges
8. `isStaleSeededUsedBalance()` - 8 edges
9. `buildRecurringEffects()` - 8 edges
10. `reconcileRecurringTransactions()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `1107313 Migrate PWA to React Vite` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 5 → community 3_
- `11bd0ef Use explicit credit used balance` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 6 → community 3_
- `11bd0ef Use explicit credit used balance` --PARENT_OF--> `a7f53c4 Fix credit balance and local date handling`  [EXTRACTED]
  git → git  _Bridges community 6 → community 0_
- `16c9b6b Add transaction editing and recurring automation` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 0 → community 3_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (69): 16c9b6b Add transaction editing and recurring automation, a7f53c4 Fix credit balance and local date handling, cb49078 Track card payments in used balance, addDays(), almostEqual(), applyTransactionToPeriods(), applyTransactionToState(), asNumber() (+61 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (19): lucide-react, recharts, ConfirmConfig, emptyRecurring, FinancialInsight, GuidedTourStep, guidedTourSteps, GuideTopic (+11 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (42): duePayrollPeriodsFor(), duePeriodsFor(), afterCardPayment, afterCutoffPurchase, calculated, cardPayment, cashDeletedState, cashExpense (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (30): main, sync_state, 12bd41c Add ponytail and graphify dependencies, 12fd07a Apply debit recurring payments to savings, 1f49763 Deploy Cloudflare KV sync backend, 32ea379 Fix manual balance movement updates, 4e52d92 Fix mobile menu scroll lock, 54e9dd9 Add guided app tour (+22 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (8): worker.ts, db, FakeD1, FakeKV, FakeStatement, kv, payload, secret

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (13): 1107313 Migrate PWA to React Vite, applyServiceWorkerUpdate(), checkForServiceWorkerUpdate(), getServiceWorkerRegistration(), hasWaitingWorker(), PwaUpdateStatus, registerServiceWorker(), RegisterServiceWorkerOptions (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (14): 11bd0ef Use explicit credit used balance, 2a63dcc Add card debt tracking and finance docs, 3a6b2b9 Correct card used balance calculation, b893545 Fix recurring item editing, CalculatedPeriod, CardCalendarEntry, CardDebtSummary, PaymentScheduleItem (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (13): base64ToBytes(), bytesToBase64(), bytesToHex(), decryptStateFromSync(), deriveEncryptionKey(), EncryptedPayload, encryptStateForSync(), fetchSync() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (7): cloneSeed(), seedState, today, loadState(), openDb(), saveState(), AppState

### Community 9 - "Community 9"
Cohesion: 0.44
Nodes (8): CORS_HEADERS, corsHeaders(), fetch(), getState(), json(), putState(), readJson(), validateSyncId()

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (6): react-dom/client, styles.css, react, App(), buildFinancialInsights(), formatPercent()

### Community 11 - "Community 11"
Cohesion: 0.43
Nodes (6): downloadText(), exportMonthlyCsv(), exportStateJson(), readJsonFile(), toCsv(), MonthlyReport

## Knowledge Gaps
- **80 isolated node(s):** `sync_state`, `APP_SHELL`, `Toast`, `InsightTone`, `FinancialInsight` (+75 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalizeState()` connect `Community 0` to `Community 8`, `Community 7`, `Community 1`, `Community 2`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `sync_state`, `APP_SHELL`, `Toast` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06925418569254185 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04756871035940803 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.1350806451612903 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._