"use strict";

const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");

;(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  await page.route("https://meuwhats.onrender.com/site-chat/proposal/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ proposal: {
      customerName: "Alessandra",
      proposalCode: "123456",
      stage: "proposta_em_analise",
      provider: "Facta",
      status: "EM ANÁLISE",
      updatedAt: Date.now(),
      isFinal: false,
      contractLink: null,
      supportUrl: "https://www.felizcred.com.br/?chat=abrir",
    } }),
  }));
  try {
    const file = path.resolve("felizcred-site/proposta/index.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}?token=${"a".repeat(43)}`);
    await page.addStyleTag({ path: path.resolve("felizcred-site/proposta/proposta.css") });
    await page.addScriptTag({ path: path.resolve("felizcred-site/proposta/proposta.js") });
    await page.locator("#proposal:not([hidden])").waitFor();
    assert.equal(await page.locator("#customerName").textContent(), "Alessandra");
    assert.match(await page.locator("#statusLabel").textContent(), /análise/i);
    assert.equal(await page.locator("#timeline .step").count(), 6);
    assert.equal(await page.locator("#timeline .current").count(), 1);
    assert.equal(await page.locator("#primaryAction:not([hidden])").count(), 0);
    await page.screenshot({ path: "test-results/proposal-tracking-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: "test-results/proposal-tracking-desktop.png", fullPage: true });
    console.log("proposal-tracking-page: interface e estado em análise aprovados");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
