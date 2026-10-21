"use strict";

const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const SITE = process.env.FELIZCRED_SITE_URL || "http://127.0.0.1:4173/";
const now = Date.now();
let clt = null;
const messages = [
  { id: 1, direction: "visitor", body: "Tenho interesse em: Empréstimo CLT", created_at: now },
  { id: 2, direction: "agent", body: "Você já completou mais de 3 meses?", sender_name: "Assistente FelizCred", created_at: now },
];

const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

;(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  await page.route("https://meuwhats.onrender.com/site-chat/conversations**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && /\/clt\/start$/.test(path)) {
      const payload = request.postDataJSON();
      assert.equal(payload.name, "Auditoria Facta");
      assert.equal(payload.phone, "47999999999");
      assert.equal(payload.cpf, "08361943900");
      clt = { provider: "facta", etapa: "autorizacao_enviada", checkedAt: now, offers: [] };
      return json(route, { clt }, 201);
    }
    if (request.method() === "POST" && /\/clt\/confirm-authorization$/.test(path)) {
      clt = { provider: "facta", etapa: "ofertas_disponiveis", offers: [{ id: "T1", installments: 24, installmentValue: 218.4, disbursedAmount: 4200, rate: 2.1, insuranceValue: 0 }] };
      return json(route, { clt });
    }
    if (request.method() === "POST" && /\/clt\/select-offer$/.test(path)) {
      clt = { provider: "facta", etapa: "dados_pessoais", selectedOffer: { installments: 24, installmentValue: 218.4, disbursedAmount: 4200 }, customerDefaults: { nome: "Cliente Teste", sexo: "F", data_nascimento: "10/01/1990", nome_mae: "Mãe Teste", celular: "47999999999" }, offers: [] };
      return json(route, { clt });
    }
    if (request.method() === "POST" && /\/clt\/personal-data$/.test(path)) {
      clt = { provider: "facta", etapa: "aguardando_assinatura_facta", contractLink: "https://facta.example/assinar", proposalCode: "12345", status: "PROPOSTA_CRIADA", offers: [] };
      return json(route, { clt }, 201);
    }
    if (request.method() === "GET" && /\/clt\/status$/.test(path)) return json(route, { clt });
    if (request.method() === "GET" && /\/conversations\/[^/]+$/.test(path)) return json(route, { conversation: { id: "audit-facta" }, messages });
    if (request.method() === "POST" && /\/conversations$/.test(path)) return json(route, { conversation: { id: "audit-facta" }, token: "token", messages }, 201);
    if (request.method() === "POST") return json(route, { ok: true, cltStep: "start" }, 201);
    return json(route, { ok: true });
  });

  try {
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.locator(".fc-chat-launcher").click();
    await page.locator('[name="name"]').fill("Auditoria Facta");
    await page.locator('.fc-chat-step[data-step="0"] .fc-chat-next').click();
    await page.locator('[name="contact"]').fill("47999999999");
    await page.locator('.fc-chat-step[data-step="1"] .fc-chat-next').click();
    await page.locator('[name="email"]').fill("auditoria@example.com");
    await page.locator('.fc-chat-step[data-step="2"] .fc-chat-next').click();
    await page.locator('input[value="Empréstimo CLT"]').check({ force: true });
    await page.locator(".fc-chat-form").evaluate((form) => form.requestSubmit());
    await page.locator('[data-tenure="yes"]').click();
    const compose = page.locator('.fc-chat-compose textarea');
    await compose.waitFor();
    await compose.fill("08361943900");
    await page.locator('.fc-chat-compose').evaluate((form) => form.requestSubmit());
    await page.locator("[data-confirm-authorization]").click();
    await page.locator('[data-facta-offer="T1"]').click();
    const form = page.locator('[data-action="facta-personal"]');
    await form.waitFor();
    assert.match(await form.innerText(), /R\$\s*4\.200,00/);
    await page.locator(".fc-chat").screenshot({ path: "test-results/chat-facta-dados-mobile.png" });
    clt = { provider: "facta", etapa: "proposta_em_analise", proposalCode: "12345", status: "215 - AGUARDA AVERBAÇÃO - ASSINATURA DIGITAL OK", offers: [] };
    await page.waitForTimeout(4500);
    assert.match(await page.locator(".fc-chat-clt").innerText(), /assinatura foi recebida/i);
    await page.locator(".fc-chat").screenshot({ path: "test-results/chat-facta-status-mobile.png" });
    clt = { provider: "facta", etapa: "proposta_concluida", proposalCode: "12345", status: "16 - PAGO AO CLIENTE", offers: [] };
    await page.waitForTimeout(4500);
    assert.match(await page.locator(".fc-chat-clt").innerText(), /proposta concluída pela Facta/i);
    assert.match(await page.locator(".fc-chat-clt").innerText(), /12345/);
    await page.locator(".fc-chat").screenshot({ path: "test-results/chat-facta-concluida-mobile.png" });
    console.log("chat Facta: jornada, acompanhamento e conclusão aprovados");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
