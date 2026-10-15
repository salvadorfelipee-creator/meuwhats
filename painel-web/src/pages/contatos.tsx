import * as React from "react"
import {
  api,
  type Contato,
  type Tag,
  type EmailTemplate,
  type BroadcastContact,
  type ImportarContatoLinha,
  type GoogleContato,
  PIPELINE_ESTAGIOS,
  PIPELINE_ESTAGIOS_GENERICO,
  pipelineEstagiosPara,
  mediaUrl,
} from "@/lib/api"
import { useChannel, type Channel } from "@/lib/channel-context"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SidebarTrigger } from "@/components/blocks/sidebar"
import { Users, Phone, AtSign as InstagramIcon, Search, Megaphone, Download, Mail, Contact, X, Upload, FileSpreadsheet } from "lucide-react"
import { CampanhaWhatsAppWizard } from "@/pages/campanha-whatsapp-wizard"

// Diretório de contatos cross-canal (15/10/2026) — porte da tela equivalente construída pra
// Especitá (ver whatsapp especita/painel-web/src/pages/contatos.tsx), adaptada pro negócio de
// empréstimo da Felizcred: nomenclatura de campo personalizado, funil de pipeline e exportação
// trocados pro vocabulário certo. Não é um cadastro à parte — todo contato aqui já existe como
// conversa (Conversas > detalhes tem o cadastro completo) — esta tela só junta todo mundo de
// todos os canais numa lista pesquisável com seleção múltipla + ações em massa (campanha
// WhatsApp, e-mail, Instagram, exportar CSV, importar).
//
// Diferença importante em relação à Especitá: lá só existia UM funil de pipeline
// (PIPELINE_ESTAGIOS_GENERICO) pra tudo. Aqui a Felizcred tem DOIS: o funil de empréstimo de
// verdade (PIPELINE_ESTAGIOS: novo_lead/qualificação/documentos/análise/aprovado/perdido), que
// vale só pro número principal (CANAL_ANALYTICS_LABEL), e o genérico pros demais números/Instagram
// (ver pipelineEstagiosPara em lib/api.ts — mesma função usada em chats.tsx/pipeline.tsx). Como
// esta tela é cross-canal, cada contato é resolvido com a lista do SEU PRÓPRIO canal (ver
// nomeEstagioDoContato abaixo), não uma lista fixa só.

const AVATAR_CORES = ["#111214", "#2F6FED", "#7C5CFC", "#D9476B", "#15803D", "#B45309", "#0E7490"]
function corAvatarContato(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_CORES[h % AVATAR_CORES.length]
}
function iniciaisContato(nome: string | null, phone: string) {
  const base = (nome || phone).trim()
  const partes = base.split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

// Prioridade de quais campos personalizados aparecem na linha — campos são 100% dinâmicos (cada
// negócio cria os seus, ver GerenciarCamposPersonalizados em chats.tsx), então isto é só uma
// lista de nomes PROVÁVEIS pro negócio de empréstimo (produto, valor pedido, origem do lead,
// responsável pelo atendimento) — se o nome não existir pra um contato, o badge simplesmente não
// aparece, nada trava.
const CAMPOS_PRIORIDADE = ["Responsável", "Produto", "Valor solicitado", "Origem"]
function campoBadgesDe(c: Contato): { nome: string; valor: string }[] {
  const out: { nome: string; valor: string }[] = []
  for (const nome of CAMPOS_PRIORIDADE) {
    const valor = c.campos?.[nome]
    if (valor) out.push({ nome, valor })
    if (out.length >= 2) break
  }
  return out
}

function tagsDe(c: Contato): Tag[] {
  if (!c.tags_json) return []
  try {
    return JSON.parse(c.tags_json)
  } catch {
    return []
  }
}

function formatarData(ts: number | null) {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

// Qual rótulo de canal (label do número) um contato pertence — pra escolher a lista de etapas
// certa (pipelineEstagiosPara espera o label, não o id). Instagram sempre vem com
// business_number_id === "instagram", que corresponde ao canal sintético { id: "instagram" }
// de useChannel().
function labelDoCanalDoContato(c: Contato, channels: Channel[]): string | undefined {
  return channels.find((ch) => ch.id === c.business_number_id)?.label
}

function nomeEstagioDoContato(c: Contato, channels: Channel[]): string | null {
  if (!c.pipeline_estagio) return null
  const estagios = pipelineEstagiosPara(labelDoCanalDoContato(c, channels))
  return estagios.find((e) => e.id === c.pipeline_estagio)?.nome || c.pipeline_estagio
}

// Filtro de etapa (topo da tela) precisa cobrir os dois funis possíveis — o filtro manda o id
// puro pro backend (comparação direta com pipeline_estagio salvo, ver GET /painel/api/contatos
// em server.js), então aqui só precisamos listar as opções agrupadas por funil, sem duplicar.
const ESTAGIOS_FELIZCRED = PIPELINE_ESTAGIOS
const ESTAGIOS_OUTROS_CANAIS = PIPELINE_ESTAGIOS_GENERICO

function exportarCsv(contatos: Contato[], channels: Channel[], sufixo = "") {
  const linhas = [
    ["Nome", "Telefone", "Canal", "E-mail", "Etapa", "Tags", "Responsável", "Produto", "Valor solicitado", "Origem", "Sincronizado com Google", "Última mensagem"],
    ...contatos.map((c) => [
      c.name || "",
      c.phone,
      c.channel,
      c.email || "",
      nomeEstagioDoContato(c, channels) || "",
      tagsDe(c)
        .map((t) => t.nome)
        .join("; "),
      c.campos?.["Responsável"] || "",
      c.campos?.["Produto"] || "",
      c.campos?.["Valor solicitado"] || "",
      c.campos?.["Origem"] || "",
      c.google_sincronizado ? "Sim" : "Não",
      c.last_message_at ? new Date(c.last_message_at).toLocaleString("pt-BR") : "",
    ]),
  ]
  const csv = linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }) // BOM pro Excel não embolar acento
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `contatos-felizcred${sufixo}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Importar contatos — duas origens (planilha CSV ou Google Contatos), uma rota de importação
// só (ver api.importarContatos) — o painel só monta a lista diferente antes de mandar.

const CABECALHO_MODELO = [
  "Nome",
  "Telefone",
  "E-mail",
  "Etapa",
  "Tags (separe com |)",
  "Produto",
  "Origem",
  "Valor solicitado",
  "Responsável",
  "Data de nascimento",
  "Bairro",
]

function baixarModeloCsv() {
  // Ponto e vírgula de propósito — Excel em português do Brasil salva/abre CSV com ";" como
  // separador por padrão (vírgula é o separador decimal aqui), "," quebraria a abertura direta
  // por duplo-clique pra quem usa Excel em PT-BR.
  const exemplo = [
    "Maria Silva",
    "47999998888",
    "maria@exemplo.com",
    "Novo lead",
    "Indicação|Reengajar",
    "Consignado INSS",
    "Instagram",
    "R$ 5.000",
    "Ana",
    "15/03/1990",
    "Centro",
  ]
  const linhas = [CABECALHO_MODELO, exemplo]
  const csv = linhas.map((l) => l.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\r\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "modelo-importar-contatos.csv"
  a.click()
  URL.revokeObjectURL(url)
}

// Parser de CSV sem dependência nova — detecta "," ou ";" como separador (planilha brasileira
// costuma salvar com ";"), entende campo entre aspas com vírgula/quebra de linha dentro e aspas
// escapadas (""), e ignora BOM do começo do arquivo.
function parseCsv(texto: string): string[][] {
  const semBom = texto.replace(/^﻿/, "")
  const primeiraLinha = semBom.split(/\r?\n/)[0] || ""
  const delim = (primeiraLinha.match(/;/g) || []).length > (primeiraLinha.match(/,/g) || []).length ? ";" : ","
  const linhas: string[][] = []
  let campo = ""
  let linha: string[] = []
  let dentroAspas = false
  for (let i = 0; i < semBom.length; i++) {
    const c = semBom[i]
    if (dentroAspas) {
      if (c === '"') {
        if (semBom[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          dentroAspas = false
        }
      } else {
        campo += c
      }
    } else if (c === '"') {
      dentroAspas = true
    } else if (c === delim) {
      linha.push(campo)
      campo = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && semBom[i + 1] === "\n") i++
      linha.push(campo)
      linhas.push(linha)
      campo = ""
      linha = []
    } else {
      campo += c
    }
  }
  if (campo || linha.length) {
    linha.push(campo)
    linhas.push(linha)
  }
  return linhas.filter((l) => l.some((c) => c.trim()))
}

const COLUNAS_FIXAS_NOMES = ["nome", "telefone", "telefone (whatsapp)", "whatsapp", "e-mail", "email", "etapa", "tags", "tags (separe com |)", "etiquetas"]

function linhasCsvParaContatos(
  linhas: string[][],
  estagiosDoDestino: readonly { id: string; nome: string }[],
): { validos: ImportarContatoLinha[]; erros: { linha: number; motivo: string }[] } {
  if (linhas.length < 2) return { validos: [], erros: [{ linha: 1, motivo: "Planilha vazia ou só com cabeçalho" }] }
  const cabecalhoOriginal = linhas[0]
  const cabecalho = cabecalhoOriginal.map((h) => h.trim().toLowerCase())
  const idx = (nomes: string[]) => cabecalho.findIndex((h) => nomes.includes(h))
  const iNome = idx(["nome"])
  const iTelefone = idx(["telefone", "telefone (whatsapp)", "whatsapp"])
  const iEmail = idx(["e-mail", "email"])
  const iEtapa = idx(["etapa"])
  const iTags = idx(["tags", "tags (separe com |)", "etiquetas"])

  const validos: ImportarContatoLinha[] = []
  const erros: { linha: number; motivo: string }[] = []
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i]
    const telefone = iTelefone >= 0 ? (cols[iTelefone] || "").trim() : ""
    if (!telefone) {
      erros.push({ linha: i + 1, motivo: "Sem telefone" })
      continue
    }
    const campos: Record<string, string> = {}
    cabecalho.forEach((h, ci) => {
      if (COLUNAS_FIXAS_NOMES.includes(h)) return
      const valor = (cols[ci] || "").trim()
      if (valor) campos[cabecalhoOriginal[ci].trim()] = valor
    })
    const etapaBruta = iEtapa >= 0 ? (cols[iEtapa] || "").trim() : ""
    const etapa = etapaBruta
      ? estagiosDoDestino.find((e) => e.id === etapaBruta || e.nome.toLowerCase() === etapaBruta.toLowerCase())?.id
      : undefined
    validos.push({
      nome: iNome >= 0 ? (cols[iNome] || "").trim() || undefined : undefined,
      telefone,
      email: iEmail >= 0 ? (cols[iEmail] || "").trim() || undefined : undefined,
      etapa,
      tags: iTags >= 0 && cols[iTags] ? cols[iTags].split("|").map((t) => t.trim()).filter(Boolean) : undefined,
      campos: Object.keys(campos).length ? campos : undefined,
    })
  }
  return { validos, erros }
}

function ImportarContatosDialog({
  open,
  onOpenChange,
  canalPadrao,
  canaisWhatsapp,
  onImportado,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  canalPadrao: string | null
  canaisWhatsapp: { id: string; label: string }[]
  onImportado: () => void
}) {
  const [aba, setAba] = React.useState<"csv" | "google">("csv")
  const [canalId, setCanalId] = React.useState(canalPadrao || "")

  // ── CSV ──
  const [nomeArquivo, setNomeArquivo] = React.useState<string | null>(null)
  const [linhasValidas, setLinhasValidas] = React.useState<ImportarContatoLinha[]>([])
  const [errosParse, setErrosParse] = React.useState<{ linha: number; motivo: string }[]>([])

  // ── Google ──
  const [contatosGoogle, setContatosGoogle] = React.useState<GoogleContato[]>([])
  const [carregandoGoogle, setCarregandoGoogle] = React.useState(false)
  const [erroGoogle, setErroGoogle] = React.useState<string | null>(null)
  const [buscaGoogle, setBuscaGoogle] = React.useState("")
  const [selecionadosGoogle, setSelecionadosGoogle] = React.useState<Set<string>>(new Set())
  // Qual conta Google está conectada — mostra ANTES da lista, pra nunca ficar na dúvida se os
  // contatos vieram da conta de verdade da Felizcred ou de alguma outra/de teste.
  const [contaGoogle, setContaGoogle] = React.useState<{ email: string | null; nome: string | null } | null>(null)

  const [importando, setImportando] = React.useState(false)
  const [resultado, setResultado] = React.useState<{ importados: number; erros: { linha: number; motivo: string }[] } | null>(null)

  // Etapas válidas pro número de destino escolhido — a Felizcred tem dois funis possíveis (ver
  // comentário no topo do arquivo), então a interpretação da coluna "Etapa" da planilha depende
  // de QUAL número vai receber os contatos.
  const estagiosDoDestino = React.useMemo(() => {
    const label = canaisWhatsapp.find((c) => c.id === canalId)?.label
    return pipelineEstagiosPara(label)
  }, [canaisWhatsapp, canalId])

  React.useEffect(() => {
    if (!open) return
    setAba("csv")
    setCanalId(canalPadrao || "")
    setNomeArquivo(null)
    setLinhasValidas([])
    setErrosParse([])
    setBuscaGoogle("")
    setSelecionadosGoogle(new Set())
    setResultado(null)
  }, [open, canalPadrao])

  React.useEffect(() => {
    if (!open || aba !== "google" || contatosGoogle.length || carregandoGoogle) return
    setCarregandoGoogle(true)
    setErroGoogle(null)
    Promise.all([api.googleContatos(), api.googleConta().catch(() => null)])
      .then(([lista, conta]) => {
        setContatosGoogle(lista)
        setContaGoogle(conta)
      })
      .catch((e) => setErroGoogle(e instanceof Error ? e.message : "Erro ao buscar contatos do Google"))
      .finally(() => setCarregandoGoogle(false))
  }, [open, aba, contatosGoogle.length, carregandoGoogle])

  function selecionarArquivo(file: File) {
    setNomeArquivo(file.name)
    setResultado(null)
    const reader = new FileReader()
    reader.onload = () => {
      const linhas = parseCsv(String(reader.result || ""))
      const { validos, erros } = linhasCsvParaContatos(linhas, estagiosDoDestino)
      setLinhasValidas(validos)
      setErrosParse(erros)
    }
    reader.readAsText(file, "utf-8")
  }

  const contatosGoogleFiltrados = React.useMemo(() => {
    const termo = buscaGoogle.trim().toLowerCase()
    if (!termo) return contatosGoogle
    return contatosGoogle.filter((c) => (c.nome || "").toLowerCase().includes(termo) || (c.telefone || "").includes(termo))
  }, [contatosGoogle, buscaGoogle])

  function alternarGoogle(resourceName: string) {
    setSelecionadosGoogle((prev) => {
      const next = new Set(prev)
      if (next.has(resourceName)) next.delete(resourceName)
      else next.add(resourceName)
      return next
    })
  }

  async function importarCsv() {
    if (!canalId || !linhasValidas.length) return
    setImportando(true)
    try {
      const r = await api.importarContatos(canalId, linhasValidas)
      setResultado(r)
      onImportado()
    } finally {
      setImportando(false)
    }
  }

  async function importarGoogle() {
    if (!canalId || !selecionadosGoogle.size) return
    setImportando(true)
    try {
      const linhas: ImportarContatoLinha[] = contatosGoogle
        .filter((c) => selecionadosGoogle.has(c.resourceName))
        .map((c) => ({
          nome: c.nome || undefined,
          telefone: c.telefone || "",
          email: c.email || undefined,
          googleResourceName: c.resourceName,
        }))
        .filter((c) => c.telefone)
      const r = await api.importarContatos(canalId, linhas)
      setResultado(r)
      onImportado()
    } finally {
      setImportando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium mb-1.5">Importar pra qual número</p>
            <select
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              value={canalId}
              onChange={(e) => setCanalId(e.target.value)}
            >
              {canaisWhatsapp.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border-b">
            <button
              onClick={() => setAba("csv")}
              className={`px-2 py-1.5 -mb-px border-b-2 ${aba === "csv" ? "border-primary text-primary" : "border-transparent"}`}
            >
              Planilha (CSV)
            </button>
            <button
              onClick={() => setAba("google")}
              className={`px-2 py-1.5 -mb-px border-b-2 ${aba === "google" ? "border-primary text-primary" : "border-transparent"}`}
            >
              Google Contatos
            </button>
          </div>

          {aba === "csv" && (
            <div className="flex flex-col gap-2.5">
              <button
                onClick={baixarModeloCsv}
                className="flex items-center gap-2 text-sm text-primary hover:underline w-fit"
              >
                <FileSpreadsheet className="h-4 w-4" /> Baixar modelo de planilha
              </button>
              <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground cursor-pointer hover:bg-muted/30">
                <Upload className="h-4 w-4" />
                {nomeArquivo || "Clique pra escolher o arquivo .csv"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) selecionarArquivo(f)
                    e.target.value = ""
                  }}
                />
              </label>
              {linhasValidas.length > 0 && (
                <p className="text-sm rounded-md border px-3 py-2 bg-muted/30">
                  <strong>{linhasValidas.length}</strong> contato(s) prontos pra importar.
                  {errosParse.length > 0 && <span className="text-destructive"> {errosParse.length} linha(s) sem telefone, ignorada(s).</span>}
                </p>
              )}
            </div>
          )}

          {aba === "google" && (
            <div className="flex flex-col gap-2.5">
              {carregandoGoogle && <p className="text-sm text-muted-foreground">Buscando contatos do Google...</p>}
              {erroGoogle && <p className="text-sm text-destructive">{erroGoogle}</p>}
              {!carregandoGoogle && !erroGoogle && contaGoogle && (
                <p className="text-xs rounded-md border px-3 py-2 bg-muted/30">
                  Conectado como <strong>{contaGoogle.email || contaGoogle.nome || "conta sem e-mail visível"}</strong> — confere se é a
                  conta de verdade da Felizcred antes de importar (muda em Configurações → Integrações).
                </p>
              )}
              {!carregandoGoogle && !erroGoogle && contatosGoogle.length > 0 && (
                <>
                  <Input placeholder="Buscar por nome ou telefone..." value={buscaGoogle} onChange={(e) => setBuscaGoogle(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    {selecionadosGoogle.size} selecionado{selecionadosGoogle.size === 1 ? "" : "s"} de {contatosGoogle.length} contatos no Google
                  </p>
                  <div className="flex flex-col divide-y rounded-md border max-h-64 overflow-y-auto">
                    {contatosGoogleFiltrados.map((c) => (
                      <label key={c.resourceName} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
                        <input
                          type="checkbox"
                          checked={selecionadosGoogle.has(c.resourceName)}
                          onChange={() => alternarGoogle(c.resourceName)}
                          className="h-3.5 w-3.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="truncate">{c.nome || c.telefone}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.telefone}
                            {c.email ? ` · ${c.email}` : ""}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
              {!carregandoGoogle && !erroGoogle && contatosGoogle.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum contato com telefone encontrado na conta Google conectada.</p>
              )}
            </div>
          )}

          {resultado && (
            <p className="text-sm rounded-md border px-3 py-2 bg-muted/30">
              <strong className="text-primary">{resultado.importados}</strong> importado(s).
              {resultado.erros.length > 0 && (
                <span className="text-destructive"> {resultado.erros.length} com erro (telefone inválido).</span>
              )}
            </p>
          )}
        </div>
        <DialogFooter>
          {aba === "csv" ? (
            <Button onClick={importarCsv} disabled={importando || !canalId || !linhasValidas.length} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {importando ? "Importando..." : `Importar ${linhasValidas.length || ""}`.trim()}
            </Button>
          ) : (
            <Button onClick={importarGoogle} disabled={importando || !canalId || !selecionadosGoogle.size} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {importando ? "Importando..." : `Importar ${selecionadosGoogle.size || ""}`.trim()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Envio de e-mail em massa pros contatos selecionados — reaproveita exatamente a mesma API de
// template/agendamento que a tela Email já usa (api.emailTemplates/api.agendarEmailCampanha, ver
// pages/email.tsx), só pré-preenchido com quem foi selecionado aqui.
function EmailSelecionadosDialog({
  open,
  onOpenChange,
  businessId,
  contatos,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  businessId: string | null
  contatos: Contato[]
}) {
  const [templates, setTemplates] = React.useState<EmailTemplate[]>([])
  const [templateId, setTemplateId] = React.useState<number | null>(null)
  const [quando, setQuando] = React.useState<"agora" | "agendar">("agora")
  const [dataHora, setDataHora] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [resultado, setResultado] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  const comEmail = React.useMemo(() => contatos.filter((c) => c.email), [contatos])
  const semEmail = contatos.length - comEmail.length

  React.useEffect(() => {
    if (!open || !businessId) return
    api.emailTemplates(businessId).then(setTemplates).catch(() => {})
  }, [open, businessId])

  React.useEffect(() => {
    if (!open) return
    setTemplateId(null)
    setQuando("agora")
    setDataHora("")
    setResultado(null)
    setErro(null)
  }, [open])

  async function enviar() {
    if (!businessId || !templateId || !comEmail.length) return
    const agendadoPara = quando === "agora" ? Date.now() : new Date(dataHora).getTime()
    if (!Number.isFinite(agendadoPara)) {
      setErro("Escolha uma data e hora válidas.")
      return
    }
    setErro(null)
    setEnviando(true)
    try {
      const itens = comEmail.map((c) => ({ email: c.email!, nome: c.name || undefined, agendadoPara }))
      const r = await api.agendarEmailCampanha(businessId, templateId, itens)
      setResultado(`${r.agendados} e-mail(s) ${quando === "agora" ? "enviados pra fila agora" : "agendados"}.`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao agendar")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar e-mail pros selecionados</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm rounded-md border px-3 py-2 bg-muted/30">
            <strong>{comEmail.length}</strong> contato(s) com e-mail cadastrado.
            {semEmail > 0 && <span className="text-muted-foreground"> {semEmail} selecionado(s) sem e-mail ficam de fora.</span>}
          </p>
          <div>
            <p className="text-sm font-medium mb-1.5">Template</p>
            <select
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              value={templateId ?? ""}
              onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{templates.length ? "Selecione um template" : "Nenhum template criado ainda (crie em Email)"}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-sm font-medium mb-1.5">Quando</p>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={quando === "agora"} onChange={() => setQuando("agora")} /> Agora
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={quando === "agendar"} onChange={() => setQuando("agendar")} /> Agendar pra depois
              </label>
            </div>
            {quando === "agendar" && (
              <Input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} className="mt-2" />
            )}
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          {resultado && <p className="text-sm text-primary">{resultado}</p>}
        </div>
        <DialogFooter>
          <Button onClick={enviar} disabled={enviando || !templateId || !comEmail.length} className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            {enviando ? "Enviando..." : quando === "agora" ? "Enviar agora" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Central de envio — mostra de uma vez só quantos de quem foi selecionado vão por cada canal, e
// manda pra tela certa (os assistentes que já existem) — um ponto de entrada só, em vez de ações
// soltas sem contexto. WhatsApp e e-mail exigem template aprovado pra alcançar gente fora da
// janela de 24h (regra da própria Meta pro WhatsApp, e já era assim pro e-mail). Instagram não
// tem sistema de template/disparo em massa (a Meta só libera responder dentro de conversa já
// aberta) — por isso aqui é mensagem individual, não campanha.
function CentralDeEnvioDialog({
  open,
  onOpenChange,
  contatos,
  onAbrirWhatsapp,
  onAbrirEmail,
  onAbrirInstagram,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  contatos: Contato[]
  onAbrirWhatsapp: () => void
  onAbrirEmail: () => void
  onAbrirInstagram: () => void
}) {
  const whatsapp = contatos.filter((c) => c.channel === "whatsapp").length
  const comEmail = contatos.filter((c) => c.email).length
  const instagram = contatos.filter((c) => c.channel === "instagram").length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar mensagem pros selecionados</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground -mt-1 mb-1">
            {contatos.length} selecionado{contatos.length === 1 ? "" : "s"} — escolha o canal; cada um recebe pelo seu próprio.
          </p>

          <button
            onClick={onAbrirWhatsapp}
            disabled={!whatsapp}
            className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="text-xs text-muted-foreground">{whatsapp} contato(s) · escolhe um template aprovado</p>
              </div>
            </div>
            <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>

          <button
            onClick={onAbrirEmail}
            disabled={!comEmail}
            className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">E-mail</p>
                <p className="text-xs text-muted-foreground">{comEmail} contato(s) com e-mail · escolhe um template</p>
              </div>
            </div>
            <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>

          {instagram > 0 && (
            <button
              onClick={onAbrirInstagram}
              className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-full bg-[#C13584]/10 text-[#C13584] flex items-center justify-center shrink-0">
                  <InstagramIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Instagram</p>
                  <p className="text-xs text-muted-foreground">
                    {instagram} contato(s) · manda um por um, não é campanha com template — a Meta só entrega pra quem
                    ainda está dentro da janela de mensagem (confirma por pessoa, não trava os outros se 1 falhar)
                  </p>
                </div>
              </div>
              <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Envio pro Instagram — manda a MESMA mensagem pra cada contato selecionado, um de cada vez
// (reaproveita a rota de reply de sempre, api.reply("instagram", phone, texto), a mesma que uma
// conversa normal usa) — não existe endpoint de "disparo em lista" pro Instagram (a Meta não
// oferece, ver CentralDeEnvioDialog acima), então isso é o mais perto que dá de fazer com
// segurança: cada envio é individual, mostra o resultado de cada um (quem está fora da janela de
// mensagem vai falhar e aparece aqui, não trava os outros).
function InstagramEnvioDialog({
  open,
  onOpenChange,
  contatos,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  contatos: Contato[]
}) {
  const [texto, setTexto] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [resultados, setResultados] = React.useState<Record<string, "ok" | "erro" | string>>({})

  React.useEffect(() => {
    if (!open) {
      setTexto("")
      setResultados({})
    }
  }, [open])

  async function enviar() {
    const valor = texto.trim()
    if (!valor || enviando) return
    setEnviando(true)
    setResultados({})
    for (const c of contatos) {
      try {
        await api.reply("instagram", c.phone, valor)
        setResultados((prev) => ({ ...prev, [c.phone]: "ok" }))
      } catch (e) {
        setResultados((prev) => ({ ...prev, [c.phone]: e instanceof Error ? e.message : "erro" }))
      }
    }
    setEnviando(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mandar mensagem pro Instagram</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground -mt-1">
            {contatos.length} selecionado{contatos.length === 1 ? "" : "s"} — manda a mesma mensagem, um de cada vez. Quem
            não responde há muito tempo pode falhar (janela de mensagem do Instagram) — aparece marcado aqui embaixo.
          </p>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Oi! Vi que você tinha interesse em um empréstimo... temos uma condição especial essa semana 😊"
            rows={4}
            disabled={enviando}
          />
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {contatos.map((c) => {
              const r = resultados[c.phone]
              return (
                <div key={c.phone} className="flex items-center justify-between gap-2 text-xs rounded-lg border px-2.5 py-1.5">
                  <span className="truncate">{c.name || c.phone}</span>
                  {r === "ok" && <span className="text-emerald-600 shrink-0">✅ Enviado</span>}
                  {r && r !== "ok" && (
                    <span className="text-destructive shrink-0 truncate max-w-[55%]" title={r}>
                      ❌ {r}
                    </span>
                  )}
                  {!r && enviando && <span className="text-muted-foreground shrink-0">Enviando...</span>}
                </div>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={enviar} disabled={enviando || !texto.trim()}>
            {enviando ? "Enviando..." : `Enviar pra ${contatos.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ContatosPage({
  onAbrirConversa,
}: {
  onAbrirConversa: (channelId: string, phone: string) => void
}) {
  const { channels, current } = useChannel()
  const [contatos, setContatos] = React.useState<Contato[]>([])
  const [carregando, setCarregando] = React.useState(true)
  const [busca, setBusca] = React.useState("")
  const [estagioFiltro, setEstagioFiltro] = React.useState("")
  const [tagFiltro, setTagFiltro] = React.useState("")
  const [emailFiltro, setEmailFiltro] = React.useState<"" | "com" | "sem">("")
  const [tagsDisponiveis, setTagsDisponiveis] = React.useState<string[]>([])
  const [erro, setErro] = React.useState<string | null>(null)

  // Seleção múltipla + ações em massa — chave única por contato é telefone+canal (o mesmo
  // telefone pode existir em mais de um número/canal).
  const [selecionados, setSelecionados] = React.useState<Set<string>>(new Set())
  const [campanhaAberta, setCampanhaAberta] = React.useState(false)
  // Botão do topo abre o assistente completo (3 passos, segmentação própria); o botão da barra
  // de seleção abre o mesmo diálogo já com os contatos escolhidos (pula pro passo 2) — um estado
  // só, essa flag decide qual dos dois modos usar.
  const [campanhaComSelecao, setCampanhaComSelecao] = React.useState(false)
  const [emailAberto, setEmailAberto] = React.useState(false)
  const [centralAberta, setCentralAberta] = React.useState(false)
  const [instagramEnvioAberto, setInstagramEnvioAberto] = React.useState(false)
  const [importarAberto, setImportarAberto] = React.useState(false)

  const chaveDe = (c: Contato) => `${c.business_number_id}-${c.phone}`

  const carregar = React.useCallback(() => {
    setCarregando(true)
    api
      .contatos({ q: busca || undefined, estagio: estagioFiltro || undefined, tag: tagFiltro || undefined, email: emailFiltro || undefined })
      .then((lista) => {
        setContatos(lista)
        setErro(null)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar contatos"))
      .finally(() => setCarregando(false))
  }, [busca, estagioFiltro, tagFiltro, emailFiltro])

  React.useEffect(() => {
    const id = setTimeout(carregar, 300) // debounce da busca
    return () => clearTimeout(id)
  }, [carregar])

  // Lista de nomes de tag pro filtro — junta de todos os números de WhatsApp (tag é por canal no
  // banco, mas aqui a tela já é cross-canal, então o filtro também é por NOME, não por id).
  React.useEffect(() => {
    const whats = channels.filter((c) => c.kind === "whatsapp")
    if (!whats.length) return
    Promise.all(whats.map((c) => api.tags(c.id)))
      .then((listas) => {
        const nomes = new Set<string>()
        for (const lista of listas.flat()) nomes.add(lista.nome)
        setTagsDisponiveis([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")))
      })
      .catch(() => {})
  }, [channels])

  function alternarSelecao(c: Contato) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      const chave = chaveDe(c)
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
  }

  const todosVisiveisSelecionados = contatos.length > 0 && contatos.every((c) => selecionados.has(chaveDe(c)))
  function alternarTodos() {
    setSelecionados((prev) => {
      if (todosVisiveisSelecionados) {
        const next = new Set(prev)
        for (const c of contatos) next.delete(chaveDe(c))
        return next
      }
      const next = new Set(prev)
      for (const c of contatos) next.add(chaveDe(c))
      return next
    })
  }

  const contatosSelecionados = React.useMemo(
    () => contatos.filter((c) => selecionados.has(chaveDe(c))),
    [contatos, selecionados],
  )

  // Canal WhatsApp pra campanha/e-mail — prioriza o canal ativo na barra lateral (se for
  // WhatsApp), senão o primeiro número WhatsApp configurado. Contatos é cross-canal de
  // propósito, então sempre precisa de uma escolha padrão sensata aqui.
  const canalWhatsappPadrao = React.useMemo(() => {
    if (current?.kind === "whatsapp") return current.id
    return channels.find((c) => c.kind === "whatsapp")?.id || null
  }, [channels, current])

  const canaisWhatsapp = React.useMemo(
    () => channels.filter((c) => c.kind === "whatsapp").map((c) => ({ id: c.id, label: c.label })),
    [channels],
  )

  const contatosWhatsappSelecionados: BroadcastContact[] = React.useMemo(
    () =>
      contatosSelecionados
        .filter((c) => c.channel === "whatsapp")
        .map((c) => ({ phone: c.phone, name: c.name || undefined })),
    [contatosSelecionados],
  )

  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5" /> Contatos
              </h1>
              <p className="text-sm text-muted-foreground">Todo mundo que já conversou, de todos os canais.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportarCsv(contatos, channels)} disabled={!contatos.length}>
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setImportarAberto(true)} disabled={!canaisWhatsapp.length}>
              <Upload className="h-3.5 w-3.5" /> Importar contatos
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setCampanhaComSelecao(false)
                setCampanhaAberta(true)
              }}
            >
              <Megaphone className="h-3.5 w-3.5" /> Nova campanha
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={estagioFiltro}
            onChange={(e) => setEstagioFiltro(e.target.value)}
          >
            <option value="">Todas as etapas</option>
            <optgroup label="Funil de empréstimo">
              {ESTAGIOS_FELIZCRED.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </optgroup>
            <optgroup label="Outros canais">
              {ESTAGIOS_OUTROS_CANAIS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </optgroup>
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={tagFiltro}
            onChange={(e) => setTagFiltro(e.target.value)}
          >
            <option value="">Todas as tags</option>
            {tagsDisponiveis.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={emailFiltro}
            onChange={(e) => setEmailFiltro(e.target.value as "" | "com" | "sem")}
          >
            <option value="">E-mail (todos)</option>
            <option value="com">Com e-mail</option>
            <option value="sem">Sem e-mail</option>
          </select>
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {carregando && contatos.length === 0 && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!carregando && contatos.length === 0 && !erro && (
          <p className="text-sm text-muted-foreground">Nenhum contato encontrado.</p>
        )}
        {!carregando && contatos.length > 0 && (
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={todosVisiveisSelecionados} onChange={alternarTodos} className="h-3.5 w-3.5" />
            <p className="text-xs text-muted-foreground">{contatos.length} contato{contatos.length === 1 ? "" : "s"}</p>
            {!todosVisiveisSelecionados && (
              <button onClick={alternarTodos} className="text-xs text-primary font-medium hover:underline">
                Selecionar todos os {contatos.length} filtrados
              </button>
            )}
          </div>
        )}

        {/* Barra de ação em massa — só aparece com algo selecionado. Separado dos filtros de
            cima de propósito: filtro é pra ACHAR gente, isso aqui é pra AGIR em cima de quem já
            foi escolhido. */}
        {selecionados.size > 0 && (
          <div className="sticky top-0 z-10 flex items-center gap-2 flex-wrap rounded-xl border bg-background shadow-sm px-3 py-2">
            <span className="text-sm font-medium">{selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}</span>
            <div className="flex-1" />
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportarCsv(contatosSelecionados, channels, "-selecionados")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setCentralAberta(true)}>
              <Megaphone className="h-3.5 w-3.5" /> Enviar mensagem
            </Button>
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => setSelecionados(new Set())}>
              <X className="h-3.5 w-3.5" /> Limpar
            </Button>
          </div>
        )}

        <div className="rounded-xl border divide-y">
          {contatos.map((c) => {
            const estagio = nomeEstagioDoContato(c, channels)
            const chave = chaveDe(c)
            const marcado = selecionados.has(chave)
            const badges = campoBadgesDe(c)
            return (
              <div
                key={chave}
                className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${marcado ? "bg-muted/60" : "hover:bg-muted/30"}`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternarSelecao(c)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 shrink-0"
                />
                <button
                  onClick={() => onAbrirConversa(c.business_number_id, c.phone)}
                  className="min-w-0 flex-1 flex items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <Avatar className="h-8 w-8 shrink-0">
                      {c.foto_url && <AvatarImage src={mediaUrl(c.foto_url)} alt="" />}
                      <AvatarFallback style={{ backgroundColor: corAvatarContato(c.phone), color: "#fff" }} className="text-[11px] font-semibold">
                        {iniciaisContato(c.name, c.phone)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {c.channel === "instagram" ? (
                          <InstagramIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <p className="text-sm font-medium truncate">{c.name || c.phone}</p>
                        <span title={c.google_sincronizado ? "Sincronizado com o Google Contatos" : "Ainda não sincronizado com o Google Contatos"}>
                          <Contact
                            className={`h-3.5 w-3.5 shrink-0 ${c.google_sincronizado ? "text-primary" : "text-muted-foreground/30"}`}
                          />
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.phone}
                        {c.email ? ` · ${c.email}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end max-w-[45%]">
                    {badges.map((b) => (
                      <Badge key={b.nome} variant="outline" className="text-[10px]" title={b.nome}>
                        {b.valor}
                      </Badge>
                    ))}
                    {tagsDe(c)
                      .slice(0, 2)
                      .map((t) => (
                        <Badge key={t.id} style={{ backgroundColor: t.cor, color: "#fff" }} className="text-[10px]">
                          {t.nome}
                        </Badge>
                      ))}
                    {estagio && (
                      <Badge variant="secondary" className="text-[10px]">
                        {estagio}
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground w-12 text-right">
                      {formatarData(c.last_message_at)}
                    </span>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <CentralDeEnvioDialog
        open={centralAberta}
        onOpenChange={setCentralAberta}
        contatos={contatosSelecionados}
        onAbrirWhatsapp={() => {
          setCentralAberta(false)
          setCampanhaComSelecao(true)
          setCampanhaAberta(true)
        }}
        onAbrirEmail={() => {
          setCentralAberta(false)
          setEmailAberto(true)
        }}
        onAbrirInstagram={() => {
          setCentralAberta(false)
          setInstagramEnvioAberto(true)
        }}
      />
      <InstagramEnvioDialog
        open={instagramEnvioAberto}
        onOpenChange={setInstagramEnvioAberto}
        contatos={contatosSelecionados.filter((c) => c.channel === "instagram")}
      />
      <CampanhaWhatsAppWizard
        open={campanhaAberta}
        onOpenChange={setCampanhaAberta}
        contaIdFixa={canalWhatsappPadrao || undefined}
        contatosFixos={campanhaComSelecao ? contatosWhatsappSelecionados : undefined}
      />
      <EmailSelecionadosDialog
        open={emailAberto}
        onOpenChange={setEmailAberto}
        businessId={canalWhatsappPadrao}
        contatos={contatosSelecionados}
      />
      <ImportarContatosDialog
        open={importarAberto}
        onOpenChange={setImportarAberto}
        canalPadrao={canalWhatsappPadrao}
        canaisWhatsapp={canaisWhatsapp}
        onImportado={carregar}
      />
    </div>
  )
}
