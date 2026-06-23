# Graph Report - .  (2026-06-23)

## Corpus Check
- Corpus is ~16,171 words - fits in a single context window. You may not need a graph.

## Summary
- 153 nodes · 281 edges · 10 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 104 · imports: 48 · calls: 33 · MODIFIES: 33 · imports_from: 27 · ON_BRANCH: 13 · PARENT_OF: 12 · method: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 30 · Candidates: 43
- Excluded: 0 untracked · 28828 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `2a63dcc`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `asNumber()` - 8 edges
2. `AppState` - 7 edges
3. `FakeStatement` - 7 edges
4. `fetch()` - 6 edges
5. `getCrypto()` - 6 edges
6. `encryptStateForSync()` - 6 edges
7. `decryptStateFromSync()` - 5 edges
8. `FakeKV` - 5 edges
9. `normalizeState()` - 4 edges
10. `applyTransactionToPeriods()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `positiveAmount()` --calls--> `asNumber()`  [EXTRACTED]
  pwa-finanzas/src/lib/calculations.ts → pwa-finanzas/src/lib/calculations.ts  _Bridges community 1 → community 7_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (12): lucide-react, recharts, ConfirmConfig, emptyRecurring, GuidedTourStep, guidedTourSteps, GuideTopic, guideTopics (+4 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (22): calculateCardDebtFor(), calculateMonthlyFor(), calculatePeriodsFor(), money, positiveAmount(), cloneSeed(), seedState, today (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (19): main, sync_state, 1107313 Migrate PWA to React Vite, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 2a63dcc Add card debt tracking and finance docs, 4e52d92 Fix mobile menu scroll lock, 54e9dd9 Add guided app tour (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (8): worker.ts, db, FakeD1, FakeKV, FakeStatement, kv, payload, secret

### Community 4 - "Community 4"
Cohesion: 0.25
Nodes (14): normalizeState(), base64ToBytes(), bytesToBase64(), bytesToHex(), decryptStateFromSync(), deriveEncryptionKey(), EncryptedPayload, encryptStateForSync() (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.46
Nodes (7): CORS_HEADERS, fetch(), getState(), json(), putState(), readJson(), validateSyncId()

### Community 6 - "Community 6"
Cohesion: 0.43
Nodes (6): downloadText(), exportMonthlyCsv(), exportStateJson(), readJsonFile(), toCsv(), MonthlyReport

### Community 7 - "Community 7"
Cohesion: 0.40
Nodes (6): applyTransactionToPeriods(), applyTransactionToState(), asNumber(), buildPaymentScheduleFor(), formatMoney(), signedTone()

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (4): react-dom/client, styles.css, react, App()

### Community 9 - "Community 9"
Cohesion: 1.00
Nodes (1): registerServiceWorker()

## Knowledge Gaps
- **30 isolated node(s):** `sync_state`, `CORS_HEADERS`, `APP_SHELL`, `Toast`, `ConfirmConfig` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (1 nodes): `registerServiceWorker()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `sync_state`, `CORS_HEADERS`, `APP_SHELL` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10837438423645321 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13666666666666666 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._