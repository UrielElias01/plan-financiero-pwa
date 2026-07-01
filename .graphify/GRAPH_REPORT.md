# Graph Report - .  (2026-07-01)

## Corpus Check
- Corpus is ~22,112 words - fits in a single context window. You may not need a graph.

## Summary
- 234 nodes · 513 edges · 16 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 172 · calls: 119 · MODIFIES: 70 · imports: 63 · imports_from: 29 · ON_BRANCH: 25 · PARENT_OF: 24 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 31 · Candidates: 44
- Excluded: 0 untracked · 28890 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `eb403b7`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `positiveAmount()` - 19 edges
2. `normalizeState()` - 12 edges
3. `asNumber()` - 11 edges
4. `baseSettingsBalance()` - 9 edges
5. `calculatedUsedCreditBalance()` - 9 edges
6. `applyTransactionToState()` - 9 edges
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
- `992401d Fix used credit balance migration` --PARENT_OF--> `bb58d8c Add financial insights and PWA updates`  [EXTRACTED]
  git → git  _Bridges community 2 → community 8_
- `9b17bd7 Fix payroll closing period dates` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 3 → community 1_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (15): lucide-react, recharts, ConfirmConfig, emptyRecurring, FinancialInsight, GuidedTourStep, guidedTourSteps, GuideTopic (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (20): main, sync_state, 1107313 Migrate PWA to React Vite, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 4e52d92 Fix mobile menu scroll lock, 54e9dd9 Add guided app tour, 64f025e Add dynamic user guide (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (22): 16c9b6b Add transaction editing and recurring automation, 992401d Fix used credit balance migration, a7f53c4 Fix credit balance and local date handling, cb49078 Track card payments in used balance, addDays(), buildNextPeriodFor(), calculateMonthlyFor(), dateForDay() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (18): 9b17bd7 Fix payroll closing period dates, cad5d20 Bump PWA cache version, eb403b7 Show base period closing with settings fallback, f6cb3c2 Add period rollover actions, duePayrollPeriodsFor(), cloneSeed(), seedState, today (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (8): worker.ts, db, FakeD1, FakeKV, FakeStatement, kv, payload, secret

### Community 5 - "Community 5"
Cohesion: 0.28
Nodes (16): almostEqual(), baseSettingsBalance(), calculateCardDebtFor(), calculatedUsedCreditBalance(), cardPaymentsByPeriod(), cardPaymentTransactionsThrough(), creditActivityThrough(), creditTransactionsThrough() (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (14): 11bd0ef Use explicit credit used balance, 2a63dcc Add card debt tracking and finance docs, 3a6b2b9 Correct card used balance calculation, b893545 Fix recurring item editing, CalculatedPeriod, CardCalendarEntry, CardDebtSummary, PaymentScheduleItem (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (13): base64ToBytes(), bytesToBase64(), bytesToHex(), decryptStateFromSync(), deriveEncryptionKey(), EncryptedPayload, encryptStateForSync(), fetchSync() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (10): bb58d8c Add financial insights and PWA updates, applyServiceWorkerUpdate(), checkForServiceWorkerUpdate(), getServiceWorkerRegistration(), hasWaitingWorker(), PwaUpdateStatus, registerServiceWorker(), RegisterServiceWorkerOptions (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.44
Nodes (8): CORS_HEADERS, corsHeaders(), fetch(), getState(), json(), putState(), readJson(), validateSyncId()

### Community 10 - "Community 10"
Cohesion: 0.28
Nodes (9): applyTransactionToPeriods(), applyTransactionToState(), asNumber(), buildPaymentScheduleFor(), formatMoney(), localId(), materializeDueRecurringTransactions(), PeriodDateParts (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (6): react-dom/client, styles.css, react, App(), buildFinancialInsights(), formatPercent()

### Community 12 - "Community 12"
Cohesion: 0.43
Nodes (6): downloadText(), exportMonthlyCsv(), exportStateJson(), readJsonFile(), toCsv(), MonthlyReport

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (6): buildRecurringEffects(), calculatePeriodsFor(), emptyRecurringEffects(), recurringEffectsFor(), recurringTotalsForPeriod(), recurringTransactionFor()

### Community 14 - "Community 14"
Cohesion: 0.83
Nodes (4): closePeriodFor(), closingIncomeFor(), closingPreviewFor(), closingRentReserveFor()

### Community 15 - "Community 15"
Cohesion: 1.00
Nodes (2): pwaStatusText(), SettingsView()

## Knowledge Gaps
- **44 isolated node(s):** `sync_state`, `APP_SHELL`, `Toast`, `InsightTone`, `FinancialInsight` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 15`** (2 nodes): `pwaStatusText()`, `SettingsView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalizeState()` connect `Community 5` to `Community 2`, `Community 13`, `Community 3`, `Community 7`, `Community 0`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `sync_state`, `APP_SHELL`, `Toast` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12923076923076923 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12307692307692308 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12554112554112554 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._