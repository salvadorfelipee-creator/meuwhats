const { chromium } = require("playwright")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const SITE = process.env.FELIZCRED_SITE_URL || "https://www.felizcred.com.br/"

async function abrirConversa(browser, assunto, sufixo) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" })
  const page = await context.newPage()
  await page.goto(SITE, { waitUntil: "domcontentloaded" })
  await page.locator(".fc-chat-launcher").click()
  await page.locator('[name="name"]').fill(`Auditoria CLT ${sufixo}`)
  await page.locator('.fc-chat-step[data-step="0"] .fc-chat-next').click()
  await page.locator('[name="contact"]').fill("47999999999")
  await page.locator('.fc-chat-step[data-step="1"] .fc-chat-next').click()
  await page.locator(`input[name="topic"][value="${assunto}"]`).check({ force: true })
  await page.locator(".fc-chat-form").evaluate((form) => form.requestSubmit())
  await page.locator(".fc-chat-root.has-conversation").waitFor({ timeout: 30000 })
  return { context, page }
}

async function enviar(page, texto) {
  const antes = await page.locator(".fc-chat-bubble").count()
  await page.locator(".fc-chat-compose textarea").fill(texto)
  await page.locator(".fc-chat-compose").evaluate((form) => form.requestSubmit())
  await page.waitForFunction((n) => document.querySelectorAll(".fc-chat-bubble").length >= n + 2, antes, { timeout: 30000 })
  return page.locator(".fc-chat-bubble.agent").last().innerText()
}

;(async () => {
  fs.mkdirSync("test-results", { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const resultados = []
  try {
    {
      const { context, page } = await abrirConversa(browser, "Empréstimo CLT", `direto-${Date.now()}`)
      const inicial = await page.locator(".fc-chat-bubble.agent").last().innerText()
      assert.match(inicial, /mais de 3 meses/i)
      const cpf = await enviar(page, "Tenho sim!")
      assert.match(cpf, /CPF/i)
      const invalido = await enviar(page, "111.111.111-11")
      assert.match(invalido, /CPF não parece válido/i)
      const banco = await enviar(page, "083.619.439-00")
      assert.doesNotMatch(banco, /mais de 3 meses/i)
      assert.match(banco, /(autorização|equipe continuará)/i)
      await page.locator(".fc-chat-clt.show").waitFor({ timeout: 30000 })
      const estadoAutorizacao = await page.locator(".fc-chat-clt").innerText()
      assert.match(estadoAutorizacao, /(autorização|banco|consulta)/i)
      await page.screenshot({ path: "test-results/chat-clt-direto.png", fullPage: true })
      resultados.push({ caminho: "CLT direto, confirmação, CPF inválido e CPF válido", ok: true, respostaBanco: banco, estadoAutorizacao })
      await context.close()
    }
    {
      const { context, page } = await abrirConversa(browser, "Empréstimo CLT", `inelegivel-${Date.now()}`)
      const resposta = await enviar(page, "Ainda não, só tenho dois meses")
      assert.match(resposta, /completar 3 meses/i)
      resultados.push({ caminho: "menos de três meses", ok: true })
      await context.close()
    }
    {
      const { context, page } = await abrirConversa(browser, "FGTS", `mudanca-${Date.now()}`)
      const entrada = await enviar(page, "Sou registrado e queria ver quanto libera pra mim")
      assert.match(entrada, /mais de 3 meses/i)
      const resposta = await enviar(page, "Já passei da experiência, tenho 6 meses")
      assert.match(resposta, /CPF/i)
      resultados.push({ caminho: "mudança de FGTS para CLT por linguagem natural", ok: true })
      await context.close()
    }
    console.log(JSON.stringify(resultados, null, 2))
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
