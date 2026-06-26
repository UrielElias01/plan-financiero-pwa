const DEFAULT_ALLOWED_ORIGIN = "*";

function corsHeaders(env = {}) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Sync-Secret",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body, status = 200, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(env),
    },
  });
}

function validateSyncId(syncId) {
  return /^[a-zA-Z0-9._-]{3,80}$/.test(syncId);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function getState(env, syncId) {
  if (env.STORE) {
    return env.STORE.get(syncId, "json");
  }

  if (env.DB) {
    const row = await env.DB.prepare(
      "SELECT secret_hash, payload, updated_at FROM sync_state WHERE sync_id = ?",
    )
      .bind(syncId)
      .first();

    if (!row) return null;
    return {
      secret_hash: row.secret_hash,
      payload: JSON.parse(row.payload),
      updated_at: row.updated_at,
    };
  }

  throw new Error("No storage binding configured");
}

async function putState(env, syncId, secretHash, payload, updatedAt) {
  if (env.STORE) {
    await env.STORE.put(
      syncId,
      JSON.stringify({
        secret_hash: secretHash,
        payload,
        updated_at: updatedAt,
      }),
    );
    return;
  }

  if (env.DB) {
    await env.DB.prepare(
      `INSERT INTO sync_state (sync_id, secret_hash, payload, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(sync_id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
    )
      .bind(syncId, secretHash, JSON.stringify(payload), updatedAt)
      .run();
    return;
  }

  throw new Error("No storage binding configured");
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "plan-financiero-sync" }, 200, env);
    }

    const match = url.pathname.match(/^\/api\/sync\/([^/]+)$/);
    if (!match) {
      return json({ error: "Not found" }, 404, env);
    }

    const syncId = decodeURIComponent(match[1]);
    if (!validateSyncId(syncId)) {
      return json({ error: "Invalid sync id" }, 400, env);
    }

    const secretHash = request.headers.get("X-Sync-Secret");
    if (!secretHash || !/^[a-f0-9]{64}$/i.test(secretHash)) {
      return json({ error: "Missing or invalid sync secret" }, 401, env);
    }

    if (request.method === "GET") {
      const state = await getState(env, syncId);

      if (!state) {
        return json({ error: "No sync state found" }, 404, env);
      }
      if (state.secret_hash !== secretHash) {
        return json({ error: "Invalid sync secret" }, 403, env);
      }
      return json({
        payload: state.payload,
        updatedAt: state.updated_at,
      }, 200, env);
    }

    if (request.method === "PUT") {
      const body = await readJson(request);
      if (!body?.payload?.ciphertext || !body?.payload?.salt || !body?.payload?.iv) {
        return json({ error: "Invalid encrypted payload" }, 400, env);
      }

      const existing = await getState(env, syncId);

      if (existing && existing.secret_hash !== secretHash) {
        return json({ error: "Invalid sync secret" }, 403, env);
      }

      const now = new Date().toISOString();
      await putState(env, syncId, secretHash, body.payload, now);

      return json({ ok: true, updatedAt: now }, 200, env);
    }

    return json({ error: "Method not allowed" }, 405, env);
  },
};
