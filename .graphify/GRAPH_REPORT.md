# Graph Report - .  (2026-07-12)

## Corpus Check
- Corpus is ~22,381 words - fits in a single context window. You may not need a graph.

## Summary
- 293 nodes · 647 edges · 17 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 222 · calls: 144 · MODIFIES: 99 · imports: 75 · ON_BRANCH: 34 · PARENT_OF: 33 · imports_from: 29 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 31 · Candidates: 44
- Excluded: 0 untracked · 28925 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `529652b`
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
- `11bd0ef Use explicit credit used balance` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 5 → community 2_
- `11bd0ef Use explicit credit used balance` --PARENT_OF--> `a7f53c4 Fix credit balance and local date handling`  [EXTRACTED]
  git → git  _Bridges community 5 → community 4_
- `16c9b6b Add transaction editing and recurring automation` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 4 → community 2_
- `applyTransactionToState()` --calls--> `applyTransactionToPeriods()`  [EXTRACTED]
  pwa-finanzas/src/lib/calculations.ts → pwa-finanzas/src/lib/calculations.ts  _Bridges community 6 → community 13_
- `buildPaymentScheduleFor()` --calls--> `asNumber()`  [EXTRACTED]
  pwa-finanzas/src/lib/calculations.ts → pwa-finanzas/src/lib/calculations.ts  _Bridges community 8 → community 9_

## Communities

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (34): sync_state, APP_SHELL, cacheFirstFallback(), networkFirst(), 1107313 Migrate PWA to React Vite, 12bd41c Add ponytail and graphify dependencies, 12fd07a Apply debit recurring payments to savings, 1f49763 Deploy Cloudflare KV sync backend (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.44
Nodes (8): corsHeaders(), json(), validateSyncId(), readJson(), getState(), putState(), fetch(), CORS_HEADERS

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (19): Toast, InsightTone, FinancialInsight, ConfirmConfig, RecurringDraft, NavItem, navItems, GuideTopic (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.29
Nodes (6): formatPercent(), buildFinancialInsights(), App(), react, react-dom/client, styles.css

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (16): money, RecurringEffects, PeriodMovementTotals, monthByName, monthNames, nextPeriodParts(), periodLabelFor(), estimatedPeriodFor() (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.27
Nodes (10): asNumber(), formatMoney(), signedTone(), PeriodDateParts, closePeriodFor(), reopenPeriodFor(), periodIdForDate(), closingIncomeFor() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (14): positiveAmount(), openingCardBalance(), baseSettingsBalance(), duplicatedLegacyBalance(), legacyPurchaseCoverage(), isStaleSeededUsedBalance(), creditTransactionsThrough(), cardPaymentTransactionsThrough() (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.21
Nodes (13): almostEqual(), localId(), padDatePart(), dateForDay(), addDays(), periodIdFor(), paydayForPeriod(), recurringHalf() (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.25
Nodes (8): currentOpenPeriodIndex(), emptyRecurringEffects(), recurringEffectsFor(), recurringTransactionFor(), buildRecurringEffects(), movementTotalsByPeriod(), calculatePeriodsFor(), recurringTotalsForPeriod()

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (42): duePeriodsFor(), state, payroll, withPayroll, withoutPayroll, cashExpense, withCash, creditPurchase (+34 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (9): normalizeRecurringItems(), normalizePeriods(), normalizeTransactions(), migrateLegacyDebitRecurringImpacts(), migrateLegacyCreditRecurringSchedules(), normalizeState(), applyTransactionToPeriods(), normalizedSearchText() (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.43
Nodes (6): downloadText(), readJsonFile(), toCsv(), exportStateJson(), exportMonthlyCsv(), MonthlyReport

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (9): PwaUpdateStatus, RegisterServiceWorkerOptions, hasWaitingWorker(), watchForWaitingWorker(), waitForInstallingWorker(), registerServiceWorker(), getServiceWorkerRegistration(), checkForServiceWorkerUpdate() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (7): today, seedState, cloneSeed(), openDb(), loadState(), saveState(), AppState

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (13): EncryptedPayload, getCrypto(), randomBytes(), bytesToBase64(), base64ToBytes(), bytesToHex(), sha256Hex(), deriveEncryptionKey() (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (14): Settings, Period, RecurringItem, PaymentScheduleItem, Transaction, CardCalendarEntry, CardDebtSummary, SyncSettings (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (8): FakeStatement, FakeD1, FakeKV, db, kv, secret, payload, worker.ts

## Knowledge Gaps
- **80 isolated node(s):** `sync_state`, `APP_SHELL`, `Toast`, `InsightTone`, `FinancialInsight` (+75 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalizeState()` connect `Community 13` to `Community 4`, `Community 9`, `Community 6`, `Community 14`, `Community 11`, `Community 7`, `Community 0`, `Community 1`, `Community 8`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `sync_state`, `APP_SHELL`, `Toast` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.10128205128205128 - nodes in this community are weakly interconnected._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04756871035940803 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.13157894736842105 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._