# Graph Report - .  (2026-06-25)

## Corpus Check
- Corpus is ~18,720 words - fits in a single context window. You may not need a graph.

## Summary
- 190 nodes · 392 edges · 14 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 136 · calls: 85 · imports: 50 · MODIFIES: 48 · imports_from: 27 · ON_BRANCH: 18 · PARENT_OF: 17 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 30 · Candidates: 43
- Excluded: 0 untracked · 28828 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `cb49078`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `positiveAmount()` - 16 edges
2. `normalizeState()` - 11 edges
3. `asNumber()` - 9 edges
4. `calculatedUsedCreditBalance()` - 9 edges
5. `baseSettingsBalance()` - 8 edges
6. `materializeDueRecurringTransactions()` - 8 edges
7. `applyTransactionToState()` - 8 edges
8. `buildRecurringEffects()` - 7 edges
9. `calculateCardDebtFor()` - 7 edges
10. `AppState` - 7 edges

## Surprising Connections (you probably didn't know these)
- `11bd0ef Use explicit credit used balance` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 2 → community 1_
- `12bd41c Add ponytail and graphify dependencies` --PARENT_OF--> `2a63dcc Add card debt tracking and finance docs`  [EXTRACTED]
  git → git  _Bridges community 1 → community 4_
- `3a6b2b9 Correct card used balance calculation` --PARENT_OF--> `b893545 Fix recurring item editing`  [EXTRACTED]
  git → git  _Bridges community 4 → community 2_
- `applyTransactionToState()` --calls--> `baseSettingsBalance()`  [EXTRACTED]
  pwa-finanzas/src/lib/calculations.ts → pwa-finanzas/src/lib/calculations.ts  _Bridges community 8 → community 6_
- `buildRecurringEffects()` --calls--> `buildPaymentScheduleFor()`  [EXTRACTED]
  pwa-finanzas/src/lib/calculations.ts → pwa-finanzas/src/lib/calculations.ts  _Bridges community 10 → community 8_

## Communities

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (18): sync_state, APP_SHELL, 1107313 Migrate PWA to React Vite, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 4e52d92 Fix mobile menu scroll lock, 54e9dd9 Add guided app tour, 64f025e Add dynamic user guide (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.46
Nodes (7): CORS_HEADERS, json(), validateSyncId(), readJson(), getState(), putState(), fetch()

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (13): Toast, ConfirmConfig, RecurringDraft, NavItem, navItems, GuideTopic, GuidedTourStep, SpotlightRect (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.40
Nodes (4): App(), react, react-dom/client, styles.css

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (17): money, almostEqual(), RecurringEffects, RecurringPeriodTotals, monthByName, padDatePart(), dateForDay(), addDays() (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.28
Nodes (9): asNumber(), formatMoney(), signedTone(), localId(), PeriodDateParts, materializeDueRecurringTransactions(), buildPaymentScheduleFor(), applyTransactionToPeriods() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (13): positiveAmount(), openingCardBalance(), baseSettingsBalance(), duplicatedLegacyBalance(), legacyPurchaseCoverage(), creditTransactionsThrough(), cardPaymentTransactionsThrough(), cardPaymentsByPeriod() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.33
Nodes (6): emptyRecurringEffects(), recurringEffectsFor(), recurringTransactionFor(), recurringTotalsForPeriod(), buildRecurringEffects(), calculatePeriodsFor()

### Community 11 - "Community 11"
Cohesion: 0.53
Nodes (5): downloadText(), readJsonFile(), toCsv(), exportStateJson(), exportMonthlyCsv()

### Community 13 - "Community 13"
Cohesion: 1.00
Nodes (1): registerServiceWorker()

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (7): today, seedState, cloneSeed(), openDb(), loadState(), saveState(), AppState

### Community 5 - "Community 5"
Cohesion: 0.27
Nodes (13): EncryptedPayload, getCrypto(), randomBytes(), bytesToBase64(), base64ToBytes(), bytesToHex(), sha256Hex(), deriveEncryptionKey() (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (13): Settings, Period, RecurringItem, PaymentScheduleItem, Transaction, CardCalendarEntry, CardDebtSummary, SyncSettings (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (8): FakeStatement, FakeD1, FakeKV, db, kv, secret, payload, worker.ts

## Knowledge Gaps
- **34 isolated node(s):** `sync_state`, `CORS_HEADERS`, `APP_SHELL`, `Toast`, `ConfirmConfig` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 13`** (1 nodes): `registerServiceWorker()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalizeState()` connect `Community 6` to `Community 2`, `Community 10`, `Community 7`, `Community 5`, `Community 0`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `sync_state`, `CORS_HEADERS`, `APP_SHELL` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14130434782608695 - nodes in this community are weakly interconnected._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._