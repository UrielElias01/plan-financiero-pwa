const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sync-Secret",
  "Access-Control-Max-Age": "86400",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "plan-financiero-sync" });
    }

    const match = url.pathname.match(/^\/api\/sync\/([^/]+)$/);
    if (!match) {
      return json({ error: "Not found" }, 404);
    }

    const syncId = decodeURIComponent(match[1]);
    if (!validateSyncId(syncId)) {
      return json({ error: "Invalid sync id" }, 400);
    }

    const secretHash = request.headers.get("X-Sync-Secret");
    if (!secretHash || !/^[a-f0-9]{64}$/i.test(secretHash)) {
      return json({ error: "Missing or invalid sync secret" }, 401);
    }

    if (request.method === "GET") {
      const row = await env.DB.prepare(
        "SELECT secret_hash, payload, updated_at FROM sync_state WHERE sync_id = ?",
      )
        .bind(syncId)
        .first();

      if (!row) {
        return json({ error: "No sync state found" }, 404);
      }
      if (row.secret_hash !== secretHash) {
        return json({ error: "Invalid sync secret" }, 403);
      }
      return json({
        payload: JSON.parse(row.payload),
        updatedAt: row.updated_at,
      });
    }

    if (request.method === "PUT") {
      const body = await readJson(request);
      if (!body?.payload?.ciphertext || !body?.payload?.salt || !body?.payload?.iv) {
        return json({ error: "Invalid encrypted payload" }, 400);
      }

      const existing = await env.DB.prepare(
        "SELECT secret_hash FROM sync_state WHERE sync_id = ?",
      )
        .bind(syncId)
        .first();

      if (existing && existing.secret_hash !== secretHash) {
        return json({ error: "Invalid sync secret" }, 403);
      }

      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO sync_state (sync_id, secret_hash, payload, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(sync_id) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
      )
        .bind(syncId, secretHash, JSON.stringify(body.payload), now)
        .run();

      return json({ ok: true, updatedAt: now });
    }

    return json({ error: "Method not allowed" }, 405);
  },
};
