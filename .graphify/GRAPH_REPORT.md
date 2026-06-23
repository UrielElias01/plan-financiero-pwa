# Graph Report - .  (2026-06-23)

## Corpus Check
- Corpus is ~17,215 words - fits in a single context window. You may not need a graph.

## Summary
- 175 nodes · 337 edges · 11 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 123 · calls: 54 · imports: 49 · MODIFIES: 42 · imports_from: 27 · ON_BRANCH: 16 · PARENT_OF: 15 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 30 · Candidates: 43
- Excluded: 0 untracked · 28829 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `11bd0ef`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `asNumber()` - 9 edges
2. `positiveAmount()` - 9 edges
3. `buildRecurringEffects()` - 7 edges
4. `normalizeState()` - 7 edges
5. `AppState` - 7 edges
6. `FakeStatement` - 7 edges
7. `fetch()` - 6 edges
8. `applyTransactionToState()` - 6 edges
9. `getCrypto()` - 6 edges
10. `encryptStateForSync()` - 6 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (13): lucide-react, recharts, ConfirmConfig, emptyRecurring, GuidedTourStep, guidedTourSteps, GuideTopic, guideTopics (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (28): applyTransactionToPeriods(), applyTransactionToState(), asNumber(), baseSettingsBalance(), buildPaymentScheduleFor(), buildRecurringEffects(), calculateCardDebtFor(), calculateMonthlyFor() (+20 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (22): main, sync_state, 1107313 Migrate PWA to React Vite, 11bd0ef Use explicit credit used balance, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 2a63dcc Add card debt tracking and finance docs, 3a6b2b9 Correct card used balance calculation (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (8): worker.ts, db, FakeD1, FakeKV, FakeStatement, kv, payload, secret

### Community 4 - "Community 4"
Cohesion: 0.27
Nodes (13): base64ToBytes(), bytesToBase64(), bytesToHex(), decryptStateFromSync(), deriveEncryptionKey(), EncryptedPayload, encryptStateForSync(), fetchSync() (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (11): CalculatedPeriod, CardCalendarEntry, CardDebtSummary, MonthlyReport, PaymentScheduleItem, Period, RecurringItem, Settings (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (7): cloneSeed(), seedState, today, loadState(), openDb(), saveState(), AppState

### Community 7 - "Community 7"
Cohesion: 0.46
Nodes (7): CORS_HEADERS, fetch(), getState(), json(), putState(), readJson(), validateSyncId()

### Community 8 - "Community 8"
Cohesion: 0.53
Nodes (5): downloadText(), exportMonthlyCsv(), exportStateJson(), readJsonFile(), toCsv()

### Community 9 - "Community 9"
Cohesion: 0.40
Nodes (4): react-dom/client, styles.css, react, App()

### Community 10 - "Community 10"
Cohesion: 1.00
Nodes (1): registerServiceWorker()

## Knowledge Gaps
- **34 isolated node(s):** `sync_state`, `CORS_HEADERS`, `APP_SHELL`, `Toast`, `ConfirmConfig` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 10`** (1 nodes): `registerServiceWorker()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `sync_state`, `CORS_HEADERS`, `APP_SHELL` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11553030303030302 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12433862433862433 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._