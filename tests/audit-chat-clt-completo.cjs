const { chromium } = require("playwright")
const assert = require("node:assert/strict")

const SITE = process.env.FELIZCRED_SITE_URL || "https://www.felizcred.com.br/"
const now = Date.now()
let clt = null
const messages = [
  { id: 1, direction: "visitor", body: "Tenho interesse em: Empréstimo CLT", created_at: now },
  { id: 2, direction: "agent", body: "Você já completou mais de 3 meses no emprego atual?", sender_name: "Assistente FelizCred", created_at: now },
]

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "pt-BR" })
  await page.route("https://meuwhats.onrender.com/site-chat/conversations**", async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === "POST" && /\/clt\/start$/.test(url.pathname)) {
      clt = { etapa: "aguardando_autorizacao", termsLink: "https://banco.example/autorizar", offers: [] }
      return json(route, { clt }, 201)
    }
    if (req.method() === "POST" && /\/clt\/resimulate$/.test(url.pathname)) return json(route, { clt })
    if (req.method() === "POST" && /\/clt\/formalize$/.test(url.pathname)) {
      clt = { etapa: "aguardando_assinatura", contractLink: "https://banco.example/assinar", offers: [] }
      return json(route, { clt }, 202)
    }
    if (req.method() === "GET" && /\/clt\/status$/.test(url.pathname)) return json(route, { clt })
    if (req.method() === "GET" && /\/conversations\/[a-z0-9-]+$/.test(url.pathname)) {
      return json(route, { conversation: { id: "audit-clt", name: "Auditoria", status: "open", updated_at: now }, messages })
    }
    if (req.method() === "POST" && /\/conversations$/.test(url.pathname)) {
      return json(route, { conversation: { id: "audit-clt" }, token: "token-auditoria", messages }, 201)
    }
    if (req.method() === "POST") {
      const body = req.postDataJSON()
      if (/sim, tenho/i.test(body.message || "")) return json(route, { ok: true, clt: true, cltStep: "start" }, 201)
      if (/ainda não/i.test(body.message || "")) return json(route, { ok: true, clt: true, cltStep: "ineligible" }, 201)
    }
    return json(route, { ok: true, clt: true })
  })

  try {
    await page.goto(SITE, { waitUntil: "domcontentloaded" })
    await page.locator(".fc-chat-launcher").click()
    await page.locator('[name="name"]').fill("Auditoria completa")
    await page.locator('.fc-chat-step[data-step="0"] .fc-chat-next').click()
    await page.locator('[name="contact"]').fill("47999999999")
    await page.locator('.fc-chat-step[data-step="1"] .fc-chat-next').click()
    await page.locator('input[value="Empréstimo CLT"]').check({ force: true })
    await page.locator(".fc-chat-form").evaluate((form) => form.requestSubmit())

    await page.locator('[data-tenure="yes"]').waitFor()
    const inicioResposta = Date.now()
    await page.locator('[data-tenure="yes"]').click()
    await page.locator(".fc-chat-typing.show").waitFor()
    await page.locator('.fc-clt-card[data-action="start"]').waitFor()
    assert.ok(Date.now() - inicioResposta >= 1400, "a resposta deve respeitar o atraso de digitação")
    await page.locator('.fc-clt-card[data-action="start"] input[name="cpf"]').fill("083.619.439-00")
    await page.locator('.fc-clt-card[data-action="start"]').evaluate((form) => form.requestSubmit())
    await page.locator('a[href="https://banco.example/autorizar"]').waitFor()

    clt = {
      etapa: "oferta_disponivel",
      offers: [
        { simulationId: "24", installments: 24, installmentValue: 280, disbursedAmount: 4800, cetMonthlyRate: 3.2 },
        { simulationId: "18", installments: 18, installmentValue: 340, disbursedAmount: 4650, cetMonthlyRate: 3.1 },
      ],
    }
    await page.waitForTimeout(4500)
    const prazos = await page.locator(".fc-clt-offer > span").allTextContents()
    assert.deepEqual(prazos, ["18 parcelas de", "24 parcelas de"])

    await page.locator("[data-lower]").click()
    await page.locator('.fc-clt-resim input[name="installmentValue"]').fill("999")
    await page.locator(".fc-clt-resim").evaluate((form) => form.requestSubmit())
    await page.locator(".fc-clt-inline-error").waitFor({ state: "visible" })
    assert.match(await page.locator(".fc-clt-inline-error").innerText(), /máximo permitido/i)

    await page.locator('.fc-clt-resim input[name="installmentValue"]').fill("250")
    await page.locator(".fc-clt-resim").evaluate((form) => form.requestSubmit())
    await page.locator('[data-offer="18"]').click()
    const form = page.locator('.fc-clt-formalize[data-action="formalize"]')
    const valores = {
      nome: "Cliente Teste", data_nascimento: "1990-01-10", profissao: "Vendedor", celular: "47999999999",
      email: "cliente@example.com", cep: "88350000", rua: "Rua Teste", numero: "10", bairro: "Centro",
      cidade: "Brusque", uf: "SC", email_rh: "rh@example.com", pix_chave: "08361943900",
    }
    for (const [campo, valor] of Object.entries(valores)) await form.locator(`[name="${campo}"]`).fill(valor)
    await form.locator('[name="genero"]').selectOption("M")
    await form.locator('.fc-clt-consent input').check()
    await form.evaluate((node) => node.requestSubmit())
    await page.locator('a[href="https://banco.example/assinar"]').waitFor()
    await page.screenshot({ path: "test-results/chat-clt-assinatura.png" })
    console.log(JSON.stringify({ elegibilidade: true, autorizacao: true, ofertasOrdenadas: prazos, limiteParcela: true, formulario: true, assinatura: true }, null, 2))
  } finally {
    await browser.close()
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
