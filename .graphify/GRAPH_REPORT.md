# Graph Report - .  (2026-06-30)

## Corpus Check
- Corpus is ~21,848 words - fits in a single context window. You may not need a graph.

## Summary
- 222 nodes · 474 edges · 16 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 165 · calls: 114 · imports: 58 · MODIFIES: 58 · imports_from: 27 · ON_BRANCH: 21 · PARENT_OF: 20 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 30 · Candidates: 43
- Excluded: 1 untracked · 28859 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `bb58d8c`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `positiveAmount()` - 18 edges
2. `normalizeState()` - 12 edges
3. `asNumber()` - 10 edges
4. `baseSettingsBalance()` - 9 edges
5. `calculatedUsedCreditBalance()` - 9 edges
6. `applyTransactionToState()` - 9 edges
7. `isStaleSeededUsedBalance()` - 8 edges
8. `materializeDueRecurringTransactions()` - 8 edges
9. `calculateCardDebtFor()` - 8 edges
10. `fetch()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `11bd0ef Use explicit credit used balance` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 2 → community 1_
- `12bd41c Add ponytail and graphify dependencies` --PARENT_OF--> `2a63dcc Add card debt tracking and finance docs`  [EXTRACTED]
  git → git  _Bridges community 1 → community 6_
- `3a6b2b9 Correct card used balance calculation` --PARENT_OF--> `b893545 Fix recurring item editing`  [EXTRACTED]
  git → git  _Bridges community 6 → community 2_
- `992401d Fix used credit balance migration` --PARENT_OF--> `bb58d8c Add financial insights and PWA updates`  [EXTRACTED]
  git → git  _Bridges community 2 → community 7_
- `bb58d8c Add financial insights and PWA updates` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 7 → community 1_

## Communities

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (20): sync_state, APP_SHELL, cacheFirstFallback(), networkFirst(), 1107313 Migrate PWA to React Vite, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 4e52d92 Fix mobile menu scroll lock (+12 more)

### Community 9 - "Community 9"
Cohesion: 0.44
Nodes (8): corsHeaders(), json(), validateSyncId(), readJson(), getState(), putState(), fetch(), CORS_HEADERS

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (15): Toast, InsightTone, FinancialInsight, ConfirmConfig, RecurringDraft, NavItem, navItems, GuideTopic (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.29
Nodes (6): formatPercent(), buildFinancialInsights(), App(), react, react-dom/client, styles.css

### Community 15 - "Community 15"
Cohesion: 1.00
Nodes (2): pwaStatusText(), SettingsView()

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (20): money, RecurringEffects, RecurringPeriodTotals, monthByName, monthNames, nextPeriodParts(), periodLabelFor(), estimatedPeriodFor() (+12 more)

### Community 10 - "Community 10"
Cohesion: 0.28
Nodes (9): asNumber(), formatMoney(), signedTone(), localId(), PeriodDateParts, materializeDueRecurringTransactions(), buildPaymentScheduleFor(), applyTransactionToPeriods() (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.28
Nodes (16): positiveAmount(), almostEqual(), openingCardBalance(), baseSettingsBalance(), duplicatedLegacyBalance(), legacyPurchaseCoverage(), isStaleSeededUsedBalance(), creditTransactionsThrough() (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (8): padDatePart(), dateForDay(), addDays(), periodIdFor(), paydayForPeriod(), recurringHalf(), recurringDateForPeriod(), periodStartDate()

### Community 14 - "Community 14"
Cohesion: 0.33
Nodes (6): emptyRecurringEffects(), recurringEffectsFor(), recurringTransactionFor(), recurringTotalsForPeriod(), buildRecurringEffects(), calculatePeriodsFor()

### Community 13 - "Community 13"
Cohesion: 0.43
Nodes (6): downloadText(), readJsonFile(), toCsv(), exportStateJson(), exportMonthlyCsv(), MonthlyReport

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (10): PwaUpdateStatus, RegisterServiceWorkerOptions, hasWaitingWorker(), watchForWaitingWorker(), waitForInstallingWorker(), registerServiceWorker(), getServiceWorkerRegistration(), checkForServiceWorkerUpdate() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (7): today, seedState, cloneSeed(), openDb(), loadState(), saveState(), AppState

### Community 5 - "Community 5"
Cohesion: 0.27
Nodes (13): EncryptedPayload, getCrypto(), randomBytes(), bytesToBase64(), base64ToBytes(), bytesToHex(), sha256Hex(), deriveEncryptionKey() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (12): Settings, Period, RecurringItem, PaymentScheduleItem, Transaction, CardCalendarEntry, CardDebtSummary, SyncSettings (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (8): FakeStatement, FakeD1, FakeKV, db, kv, secret, payload, worker.ts

## Knowledge Gaps
- **38 isolated node(s):** `sync_state`, `APP_SHELL`, `Toast`, `InsightTone`, `FinancialInsight` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 15`** (2 nodes): `pwaStatusText()`, `SettingsView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalizeState()` connect `Community 4` to `Community 2`, `Community 14`, `Community 8`, `Community 5`, `Community 0`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `sync_state`, `APP_SHELL`, `Toast` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12923076923076923 - nodes in this community are weakly interconnected._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12318840579710146 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._