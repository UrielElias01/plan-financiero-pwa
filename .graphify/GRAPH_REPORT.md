# Graph Report - .  (2026-06-22)

## Corpus Check
- Corpus is ~14,105 words - fits in a single context window. You may not need a graph.

## Summary
- 152 nodes · 276 edges · 10 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 104 · imports: 48 · calls: 33 · MODIFIES: 30 · imports_from: 27 · ON_BRANCH: 12 · method: 11 · PARENT_OF: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: cli)
- Included files: 26 · Candidates: 38
- Excluded: 5 untracked · 28828 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `12bd41c`
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

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (18): sync_state, APP_SHELL, 1107313 Migrate PWA to React Vite, 12bd41c Add ponytail and graphify dependencies, 1f49763 Deploy Cloudflare KV sync backend, 4e52d92 Fix mobile menu scroll lock, 54e9dd9 Add guided app tour, 64f025e Add dynamic user guide (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.46
Nodes (7): CORS_HEADERS, json(), validateSyncId(), readJson(), getState(), putState(), fetch()

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (12): Toast, ConfirmConfig, NavItem, navItems, GuideTopic, GuidedTourStep, SpotlightRect, guideTopics (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (4): App(), react, react-dom/client, styles.css

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (23): money, normalizeState(), calculatePeriodsFor(), calculateMonthlyFor(), positiveAmount(), calculateCardDebtFor(), today, seedState (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.40
Nodes (6): asNumber(), formatMoney(), signedTone(), buildPaymentScheduleFor(), applyTransactionToPeriods(), applyTransactionToState()

### Community 6 - "Community 6"
Cohesion: 0.43
Nodes (6): downloadText(), readJsonFile(), toCsv(), exportStateJson(), exportMonthlyCsv(), MonthlyReport

### Community 9 - "Community 9"
Cohesion: 1.00
Nodes (1): registerServiceWorker()

### Community 4 - "Community 4"
Cohesion: 0.27
Nodes (13): EncryptedPayload, getCrypto(), randomBytes(), bytesToBase64(), base64ToBytes(), bytesToHex(), sha256Hex(), deriveEncryptionKey() (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (8): FakeStatement, FakeD1, FakeKV, db, kv, secret, payload, worker.ts

## Knowledge Gaps
- **30 isolated node(s):** `sync_state`, `CORS_HEADERS`, `APP_SHELL`, `Toast`, `ConfirmConfig` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (1 nodes): `registerServiceWorker()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `sync_state`, `CORS_HEADERS`, `APP_SHELL` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14130434782608695 - nodes in this community are weakly interconnected._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10574712643678161 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._