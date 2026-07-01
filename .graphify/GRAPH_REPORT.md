# Graph Report - .  (2026-07-01)

## Corpus Check
- Corpus is ~22,629 words - fits in a single context window. You may not need a graph.

## Summary
- 239 nodes · 529 edges · 16 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 176 · calls: 121 · MODIFIES: 74 · imports: 67 · imports_from: 29 · ON_BRANCH: 26 · PARENT_OF: 25 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 31 · Candidates: 44
- Excluded: 0 untracked · 28898 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `7b7c39e`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `positiveAmount()` - 20 edges
2. `asNumber()` - 12 edges
3. `normalizeState()` - 12 edges
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
- `applyTransactionToState()` --calls--> `baseSettingsBalance()`  [EXTRACTED]
  pwa-finanzas/src/lib/calculations.ts → pwa-finanzas/src/lib/calculations.ts  _Bridges community 10 → community 5_
- `buildRecurringEffects()` --calls--> `buildPaymentScheduleFor()`  [EXTRACTED]
  pwa-finanzas/src/lib/calculations.ts → pwa-finanzas/src/lib/calculations.ts  _Bridges community 13 → community 10_

## Communities

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (26): sync_state, APP_SHELL, cacheFirstFallback(), networkFirst(), 1107313 Migrate PWA to React Vite, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 4e52d92 Fix mobile menu scroll lock (+18 more)

### Community 9 - "Community 9"
Cohesion: 0.44
Nodes (8): corsHeaders(), json(), validateSyncId(), readJson(), getState(), putState(), fetch(), CORS_HEADERS

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (15): Toast, InsightTone, FinancialInsight, ConfirmConfig, RecurringDraft, NavItem, navItems, GuideTopic (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (6): formatPercent(), buildFinancialInsights(), App(), react, react-dom/client, styles.css

### Community 15 - "Community 15"
Cohesion: 1.00
Nodes (2): pwaStatusText(), SettingsView()

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (22): money, RecurringEffects, RecurringPeriodTotals, monthByName, monthNames, padDatePart(), dateForDay(), addDays() (+14 more)

### Community 10 - "Community 10"
Cohesion: 0.28
Nodes (9): asNumber(), formatMoney(), signedTone(), localId(), PeriodDateParts, materializeDueRecurringTransactions(), buildPaymentScheduleFor(), applyTransactionToPeriods() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.28
Nodes (16): positiveAmount(), almostEqual(), openingCardBalance(), baseSettingsBalance(), duplicatedLegacyBalance(), legacyPurchaseCoverage(), isStaleSeededUsedBalance(), creditTransactionsThrough() (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.83
Nodes (4): closingIncomeFor(), closingRentReserveFor(), closingPreviewFor(), closePeriodFor()

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (17): duePayrollPeriodsFor(), reopenPeriodFor(), today, seedState, cloneSeed(), openDb(), loadState(), saveState() (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (6): emptyRecurringEffects(), recurringEffectsFor(), recurringTransactionFor(), recurringTotalsForPeriod(), buildRecurringEffects(), calculatePeriodsFor()

### Community 12 - "Community 12"
Cohesion: 0.43
Nodes (6): downloadText(), readJsonFile(), toCsv(), exportStateJson(), exportMonthlyCsv(), MonthlyReport

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (9): PwaUpdateStatus, RegisterServiceWorkerOptions, hasWaitingWorker(), watchForWaitingWorker(), waitForInstallingWorker(), registerServiceWorker(), getServiceWorkerRegistration(), checkForServiceWorkerUpdate() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (13): EncryptedPayload, getCrypto(), randomBytes(), bytesToBase64(), base64ToBytes(), bytesToHex(), sha256Hex(), deriveEncryptionKey() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (14): Settings, Period, RecurringItem, PaymentScheduleItem, Transaction, CardCalendarEntry, CardDebtSummary, SyncSettings (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (8): FakeStatement, FakeD1, FakeKV, db, kv, secret, payload, worker.ts

## Knowledge Gaps
- **46 isolated node(s):** `sync_state`, `APP_SHELL`, `Toast`, `InsightTone`, `FinancialInsight` (+41 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 15`** (2 nodes): `pwaStatusText()`, `SettingsView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalizeState()` connect `Community 5` to `Community 2`, `Community 13`, `Community 3`, `Community 7`, `Community 0`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `sync_state`, `APP_SHELL`, `Toast` to the rest of the system?**
  _46 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11491935483870967 - nodes in this community are weakly interconnected._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12307692307692308 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11904761904761904 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._