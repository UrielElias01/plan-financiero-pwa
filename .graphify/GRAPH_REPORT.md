# Graph Report - .  (2026-06-25)

## Corpus Check
- Corpus is ~18,045 words - fits in a single context window. You may not need a graph.

## Summary
- 187 nodes · 377 edges · 11 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 134 · calls: 78 · imports: 49 · MODIFIES: 45 · imports_from: 27 · ON_BRANCH: 17 · PARENT_OF: 16 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 30 · Candidates: 43
- Excluded: 0 untracked · 28828 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `a7f53c4`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `positiveAmount()` - 15 edges
2. `normalizeState()` - 11 edges
3. `asNumber()` - 9 edges
4. `calculatedUsedCreditBalance()` - 9 edges
5. `baseSettingsBalance()` - 8 edges
6. `buildRecurringEffects()` - 7 edges
7. `calculateCardDebtFor()` - 7 edges
8. `applyTransactionToState()` - 7 edges
9. `AppState` - 7 edges
10. `FakeStatement` - 7 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (23): sync_state, APP_SHELL, 1107313 Migrate PWA to React Vite, 11bd0ef Use explicit credit used balance, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 2a63dcc Add card debt tracking and finance docs, 3a6b2b9 Correct card used balance calculation (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.46
Nodes (7): CORS_HEADERS, json(), validateSyncId(), readJson(), getState(), putState(), fetch()

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (14): Toast, ConfirmConfig, RecurringDraft, NavItem, navItems, GuideTopic, GuidedTourStep, SpotlightRect (+6 more)

### Community 9 - "Community 9"
Cohesion: 0.40
Nodes (4): App(), react, react-dom/client, styles.css

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (38): money, asNumber(), formatMoney(), signedTone(), positiveAmount(), almostEqual(), openingCardBalance(), baseSettingsBalance() (+30 more)

### Community 8 - "Community 8"
Cohesion: 0.43
Nodes (6): downloadText(), readJsonFile(), toCsv(), exportStateJson(), exportMonthlyCsv(), MonthlyReport

### Community 10 - "Community 10"
Cohesion: 1.00
Nodes (1): registerServiceWorker()

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (7): today, seedState, cloneSeed(), openDb(), loadState(), saveState(), AppState

### Community 4 - "Community 4"
Cohesion: 0.27
Nodes (13): EncryptedPayload, getCrypto(), randomBytes(), bytesToBase64(), base64ToBytes(), bytesToHex(), sha256Hex(), deriveEncryptionKey() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.20
Nodes (9): Settings, Period, RecurringItem, Transaction, CardCalendarEntry, CardDebtSummary, SyncSettings, CalculatedPeriod (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (8): FakeStatement, FakeD1, FakeKV, db, kv, secret, payload, worker.ts

## Knowledge Gaps
- **34 isolated node(s):** `sync_state`, `CORS_HEADERS`, `APP_SHELL`, `Toast`, `ConfirmConfig` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 10`** (1 nodes): `registerServiceWorker()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalizeState()` connect `Community 0` to `Community 5`, `Community 4`, `Community 1`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `sync_state`, `CORS_HEADERS`, `APP_SHELL` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1206896551724138 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10520487264673312 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._