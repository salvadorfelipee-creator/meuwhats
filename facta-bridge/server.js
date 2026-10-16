"use strict";

const http = require("http");
const crypto = require("crypto");

const PORT = Number(process.env.FACTA_BRIDGE_PORT || 8787);
const HOST = process.env.FACTA_BRIDGE_HOST || "127.0.0.1";
const SHARED_SECRET = process.env.FACTA_BRIDGE_SECRET || "";
const FACTA_USER = process.env.FACTA_USERNAME || "";
const FACTA_PASSWORD = process.env.FACTA_PASSWORD || "";
const ENVIRONMENT = process.env.FACTA_ENV === "homologation" ? "homologation" : "production";

const HOSTS = {
  production: {
    online: "https://webservice.facta.com.br",
    offline: "https://cltoff.facta.com.br",
  },
  homologation: {
    online: "https://webservice-homol.facta.com.br",
    offline: "https://cltoff-homol.facta.com.br",
  },
};

const ALLOWED = {
  online: new Set([
    "/solicita-autorizacao-consulta",
    "/consignado-trabalhador/autoriza-consulta",
    "/consignado-trabalhador/consulta-ofertas",
    "/consignado-trabalhador/analise-politica-credito",
    "/proposta/operacoes-disponiveis",
    "/proposta/etapa1-simulador",
    "/proposta/etapa2-dados-pessoais",
    "/proposta/etapa3-proposta-cadastro",
  ]),
  offline: new Set(["/clt/base-offline"]),
};

const tokenCache = new Map();

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function secretMatches(received) {
  const a = Buffer.from(String(received || ""));
  const b = Buffer.from(SHARED_SECRET);
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 256 * 1024) throw Object.assign(new Error("Corpo muito grande"), { status: 413 });
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw Object.assign(new Error("JSON inválido"), { status: 400 });
  }
}

function extractToken(payload) {
  return payload?.token || payload?.access_token || payload?.data?.token || payload?.dados?.token || null;
}

async function getToken(target) {
  const cached = tokenCache.get(target);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  const response = await fetch(`${HOSTS[ENVIRONMENT][target]}/gera-token`, {
    headers: { Authorization: `Basic ${Buffer.from(`${FACTA_USER}:${FACTA_PASSWORD}`).toString("base64")}` },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text.slice(0, 500) }; }
  const token = extractToken(payload);
  if (!response.ok || !token) {
    const error = new Error("A Facta recusou a geração do token");
    error.status = 502;
    error.upstreamStatus = response.status;
    error.upstream = payload;
    throw error;
  }
  tokenCache.set(target, { value: token, expiresAt: Date.now() + 55 * 60_000 });
  return token;
}

async function factaRequest({ target = "online", method = "GET", path, query, body }) {
  method = String(method).toUpperCase();
  if (!ALLOWED[target]?.has(path)) throw Object.assign(new Error("Rota Facta não permitida"), { status: 400 });
  if (!new Set(["GET", "POST"]).has(method)) throw Object.assign(new Error("Método não permitido"), { status: 400 });

  const url = new URL(path, HOSTS[ENVIRONMENT][target]);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const token = await getToken(target);
  const options = {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  };
  if (method === "POST") {
    options.headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.body = new URLSearchParams(Object.entries(body || {}).filter(([, v]) => v !== undefined && v !== null));
  }
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text.slice(0, 2000) }; }
  return { status: response.status, ok: response.ok, body: payload };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { ok: true, service: "facta-bridge", environment: ENVIRONMENT });
    }
    if (req.method !== "POST" || req.url !== "/v1/facta/request") return json(res, 404, { error: "not_found" });
    const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!secretMatches(bearer)) return json(res, 401, { error: "unauthorized" });
    const result = await factaRequest(await readJson(req));
    return json(res, 200, result);
  } catch (error) {
    console.error(new Date().toISOString(), error.message, error.upstreamStatus || "");
    return json(res, error.status || 500, {
      error: "bridge_error",
      message: error.message,
      upstreamStatus: error.upstreamStatus || undefined,
      upstream: error.upstream || undefined,
    });
  }
});

if (require.main === module) {
  if (!SHARED_SECRET || !FACTA_USER || !FACTA_PASSWORD) {
    console.error("Configure FACTA_BRIDGE_SECRET, FACTA_USERNAME e FACTA_PASSWORD antes de iniciar.");
    process.exit(1);
  }
  server.listen(PORT, HOST, () => {
    console.log(`Ponte Facta ativa em http://${HOST}:${PORT} (${ENVIRONMENT}).`);
  });
}

module.exports = { ALLOWED, extractToken, secretMatches, server };
