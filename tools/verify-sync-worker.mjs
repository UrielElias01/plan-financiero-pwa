import worker from "../cloudflare-sync/worker.js";

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async first() {
    const [syncId] = this.params;
    const row = this.db.rows.get(syncId);
    if (!row) return null;
    if (this.sql.includes("secret_hash, payload")) {
      return {
        secret_hash: row.secret_hash,
        payload: row.payload,
        updated_at: row.updated_at,
      };
    }
    return { secret_hash: row.secret_hash };
  }

  async run() {
    const [syncId, secretHash, payload, updatedAt] = this.params;
    this.db.rows.set(syncId, {
      secret_hash: secretHash,
      payload,
      updated_at: updatedAt,
    });
    return { success: true };
  }
}

class FakeD1 {
  constructor() {
    this.rows = new Map();
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

class FakeKV {
  constructor() {
    this.rows = new Map();
  }

  async get(key, type) {
    const value = this.rows.get(key);
    if (!value) return null;
    return type === "json" ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.rows.set(key, value);
  }
}

async function request(path, options = {}) {
  const url = `https://sync.test${path}`;
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return worker.fetch(new Request(url, { ...options, headers }), { STORE: kv });
}

async function readJson(response) {
  return response.json();
}

const db = new FakeD1();
const kv = new FakeKV();
const secret = "a".repeat(64);
const payload = {
  version: 1,
  salt: "c2FsdA==",
  iv: "aXY=",
  ciphertext: "Y2lwaGVy",
};

let response = await request("/api/health");
if (response.status !== 200 || !(await readJson(response)).ok) throw new Error("health failed");

response = await request("/api/sync/test-plan", {
  method: "PUT",
  headers: { "X-Sync-Secret": secret },
  body: JSON.stringify({ payload }),
});
if (response.status !== 200) throw new Error(`put failed ${response.status}`);

response = await request("/api/sync/test-plan", {
  headers: { "X-Sync-Secret": secret },
});
const downloaded = await readJson(response);
if (response.status !== 200 || downloaded.payload.ciphertext !== payload.ciphertext) {
  throw new Error("get failed");
}

response = await request("/api/sync/test-plan", {
  headers: { "X-Sync-Secret": "b".repeat(64) },
});
if (response.status !== 403) throw new Error("wrong secret should be rejected");

response = await request("/api/sync/bad!", {
  headers: { "X-Sync-Secret": secret },
});
if (response.status !== 400) throw new Error("bad sync id should be rejected");

console.log("Sync worker verification OK");
