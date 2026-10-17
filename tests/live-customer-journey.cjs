"use strict";

const { chromium } = require("playwright");

const required = ["LIVE_NAME", "LIVE_CPF", "LIVE_PHONE", "LIVE_BIRTH", "LIVE_EMAIL"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Variável obrigatória ausente: ${key}`);
}

async function textOf(locator) {
  return (await locator.innerText()).replace(/\s+/g, " ").trim();
}

;(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: false, slowMo: 180 });
  const context = await browser.newContext({ viewport: { width: 420, height: 860 }, locale: "pt-BR" });
  const page = await context.newPage();
  page.on("console", (message) => message.type() === "error" && console.error("browser:", message.text()));

  try {
    await page.goto("https://www.felizcred.com.br/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator(".fc-chat-launcher").click();
    await page.locator('[name="name"]').fill(process.env.LIVE_NAME);
    await page.locator('.fc-chat-step[data-step="0"] .fc-chat-next').click();
    await page.locator('[name="contact"]').fill(process.env.LIVE_PHONE);
    await page.locator('.fc-chat-step[data-step="1"] .fc-chat-next').click();
    await page.locator('input[value="Empréstimo CLT"]').check({ force: true });
    await page.locator(".fc-chat-form").evaluate((form) => form.requestSubmit());
    await page.locator('[data-tenure="yes"]').click();
    await page.locator('[data-action="start"]').waitFor({ timeout: 30_000 });
    await page.locator('[name="cpf"]').fill(process.env.LIVE_CPF);
    const consent = page.locator('[data-action="start"] .fc-clt-consent input');
    console.log("FORMULARIO_PUBLICADO:", await textOf(page.locator('[data-action="start"]')));
    await page.locator(".fc-chat").screenshot({ path: "test-results/live-facta-form-published.png" });
    if (await consent.count()) await consent.check();
    await page.locator('[data-action="start"]').evaluate((form) => form.requestSubmit());

    await page.waitForTimeout(2500);
    let card = page.locator(".fc-chat-clt");
    console.log("ESTADO_APOS_ENVIO:", await textOf(card));
    await page.locator(".fc-chat").screenshot({ path: "test-results/live-facta-after-start.png" });

    const confirm = page.locator("[data-confirm-authorization]");
    if (await confirm.count()) {
      await confirm.click();
      await page.waitForTimeout(3500);
      console.log("ESTADO_APOS_CONSULTA:", await textOf(card));
      await page.locator(".fc-chat").screenshot({ path: "test-results/live-facta-after-check.png" });
    }

    const offer = page.locator("[data-facta-offer]").first();
    if (await offer.count()) {
      console.log("OFERTA_ENCONTRADA:", await textOf(offer));
      await offer.click();
      await page.waitForTimeout(3500);
      console.log("ESTADO_APOS_ESCOLHA:", await textOf(card));
      const form = page.locator('[data-action="facta-personal"]');
      if (await form.count()) {
        await form.locator('[name="data_nascimento"]').fill(process.env.LIVE_BIRTH);
        await form.locator('[name="email"]').fill(process.env.LIVE_EMAIL);
        console.log("FORMULARIO_PROPOSTA: aberto; envio real não realizado");
        await page.locator(".fc-chat").screenshot({ path: "test-results/live-facta-personal-data.png" });
      }
    }

    await page.waitForTimeout(3000);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error("FALHA_JORNADA:", error.message);
  process.exitCode = 1;
});
