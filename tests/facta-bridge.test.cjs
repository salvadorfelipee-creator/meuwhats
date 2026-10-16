"use strict";

const assert = require("node:assert/strict");

process.env.FACTA_BRIDGE_SECRET = "segredo-de-teste";
const bridge = require("../facta-bridge/server");

assert.equal(bridge.secretMatches("segredo-de-teste"), true);
assert.equal(bridge.secretMatches("segredo-errado"), false);
assert.equal(bridge.secretMatches(""), false);
assert.equal(bridge.extractToken({ token: "a" }), "a");
assert.equal(bridge.extractToken({ access_token: "b" }), "b");
assert.equal(bridge.extractToken({ data: { token: "c" } }), "c");
assert.equal(bridge.ALLOWED.online.has("/solicita-autorizacao-consulta"), true);
assert.equal(bridge.ALLOWED.offline.has("/clt/base-offline"), true);
assert.equal(bridge.ALLOWED.online.has("https://site-malicioso.example"), false);

console.log("facta-bridge: testes unitários aprovados");
