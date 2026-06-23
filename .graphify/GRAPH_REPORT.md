# Graph Report - .  (2026-06-23)

## Corpus Check
- Corpus is ~16,328 words - fits in a single context window. You may not need a graph.

## Summary
- 157 nodes · 290 edges · 10 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 107 · imports: 48 · MODIFIES: 36 · calls: 34 · imports_from: 27 · ON_BRANCH: 14 · PARENT_OF: 13 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 30 · Candidates: 43
- Excluded: 0 untracked · 28828 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `3a6b2b9`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `asNumber()` - 8 edges
2. `AppState` - 7 edges
3. `FakeStatement` - 7 edges
4. `fetch()` - 6 edges
5. `getCrypto()` - 6 edges
6. `encryptStateForSync()` - 6 edges
7. `normalizeState()` - 5 edges
8. `decryptStateFromSync()` - 5 edges
9. `FakeKV` - 5 edges
10. `applyTransactionToPeriods()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `12bd41c Add ponytail and graphify dependencies` --PARENT_OF--> `2a63dcc Add card debt tracking and finance docs`  [EXTRACTED]
  git → git  _Bridges community 2 → community 1_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (15): RecurringItem, ViewId, lucide-react, recharts, ConfirmConfig, emptyRecurring, GuidedTourStep, guidedTourSteps (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (22): 2a63dcc Add card debt tracking and finance docs, 3a6b2b9 Correct card used balance calculation, applyTransactionToPeriods(), applyTransactionToState(), asNumber(), buildPaymentScheduleFor(), calculateCardDebtFor(), calculateMonthlyFor() (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (18): main, sync_state, 1107313 Migrate PWA to React Vite, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 4e52d92 Fix mobile menu scroll lock, 54e9dd9 Add guided app tour, 64f025e Add dynamic user guide (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (8): worker.ts, db, FakeD1, FakeKV, FakeStatement, kv, payload, secret

### Community 4 - "Community 4"
Cohesion: 0.27
Nodes (13): base64ToBytes(), bytesToBase64(), bytesToHex(), decryptStateFromSync(), deriveEncryptionKey(), EncryptedPayload, encryptStateForSync(), fetchSync() (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.25
Nodes (9): normalizeRecurringItems(), normalizeState(), cloneSeed(), seedState, today, loadState(), openDb(), saveState() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.46
Nodes (7): CORS_HEADERS, fetch(), getState(), json(), putState(), readJson(), validateSyncId()

### Community 7 - "Community 7"
Cohesion: 0.53
Nodes (5): downloadText(), exportMonthlyCsv(), exportStateJson(), readJsonFile(), toCsv()

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (4): react-dom/client, styles.css, react, App()

### Community 9 - "Community 9"
Cohesion: 1.00
Nodes (1): registerServiceWorker()

## Knowledge Gaps
- **31 isolated node(s):** `sync_state`, `CORS_HEADERS`, `APP_SHELL`, `Toast`, `ConfirmConfig` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (1 nodes): `registerServiceWorker()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `sync_state`, `CORS_HEADERS`, `APP_SHELL` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1164021164021164 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14130434782608695 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._