# Graph Report - .  (2026-06-23)

## Corpus Check
- Corpus is ~16,506 words - fits in a single context window. You may not need a graph.

## Summary
- 158 nodes · 295 edges · 11 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 107 · imports: 48 · MODIFIES: 38 · calls: 35 · imports_from: 27 · ON_BRANCH: 15 · PARENT_OF: 14 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 30 · Candidates: 43
- Excluded: 0 untracked · 28828 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `b893545`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `asNumber()` - 8 edges
2. `AppState` - 7 edges
3. `FakeStatement` - 7 edges
4. `fetch()` - 6 edges
5. `normalizeState()` - 6 edges
6. `getCrypto()` - 6 edges
7. `encryptStateForSync()` - 6 edges
8. `decryptStateFromSync()` - 5 edges
9. `FakeKV` - 5 edges
10. `positiveAmount()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `2a63dcc Add card debt tracking and finance docs` --PARENT_OF--> `3a6b2b9 Correct card used balance calculation`  [EXTRACTED]
  git → git  _Bridges community 1 → community 2_
- `positiveAmount()` --calls--> `asNumber()`  [EXTRACTED]
  pwa-finanzas/src/lib/calculations.ts → pwa-finanzas/src/lib/calculations.ts  _Bridges community 2 → community 8_

## Communities

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (19): sync_state, APP_SHELL, 1107313 Migrate PWA to React Vite, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 2a63dcc Add card debt tracking and finance docs, 4e52d92 Fix mobile menu scroll lock, 54e9dd9 Add guided app tour (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.46
Nodes (7): CORS_HEADERS, json(), validateSyncId(), readJson(), getState(), putState(), fetch()

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (13): Toast, ConfirmConfig, RecurringDraft, NavItem, navItems, GuideTopic, GuidedTourStep, SpotlightRect (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.40
Nodes (4): App(), react, react-dom/client, styles.css

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (19): money, positiveAmount(), normalizeRecurringItems(), normalizeState(), calculatePeriodsFor(), calculateMonthlyFor(), calculateCardDebtFor(), Settings (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (6): asNumber(), formatMoney(), signedTone(), buildPaymentScheduleFor(), applyTransactionToPeriods(), applyTransactionToState()

### Community 7 - "Community 7"
Cohesion: 0.43
Nodes (6): downloadText(), readJsonFile(), toCsv(), exportStateJson(), exportMonthlyCsv(), MonthlyReport

### Community 10 - "Community 10"
Cohesion: 1.00
Nodes (1): registerServiceWorker()

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (7): today, seedState, cloneSeed(), openDb(), loadState(), saveState(), AppState

### Community 4 - "Community 4"
Cohesion: 0.27
Nodes (13): EncryptedPayload, getCrypto(), randomBytes(), bytesToBase64(), base64ToBytes(), bytesToHex(), sha256Hex(), deriveEncryptionKey() (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (8): FakeStatement, FakeD1, FakeKV, db, kv, secret, payload, worker.ts

## Knowledge Gaps
- **31 isolated node(s):** `sync_state`, `CORS_HEADERS`, `APP_SHELL`, `Toast`, `ConfirmConfig` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 10`** (1 nodes): `registerServiceWorker()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `sync_state`, `CORS_HEADERS`, `APP_SHELL` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13666666666666666 - nodes in this community are weakly interconnected._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._