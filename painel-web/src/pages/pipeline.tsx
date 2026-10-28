import * as React from "react"
import { KanbanBoard, type KanbanColumn, type KanbanTask } from "@/components/ui/kanban-board"
import {
  api,
  pipelineEstagiosPara,
  conversaEhUrgente,
  mediaUrl,
  type Conversation,
  type Message,
  type Identidade,
} from "@/lib/api"
import { useChannel, type Channel } from "@/lib/channel-context"
import { useUnread } from "@/lib/unread-context"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { RefreshCw, X, Send, ExternalLink, FileText } from "lucide-react"

// Quadro kanban do pipeline — agora cruza TODOS os canais (WhatsApp + Instagram) num quadro só,
// em vez de mostrar só o canal selecionado na barra lateral (pedido real: "quero exatamente tudo
// o que tem"). Usa o componente genérico de @/components/ui/kanban-board (drag por pointer
// events, com placeholder, spring physics e teclado). `tags_json`/`campos_json` já vêm prontos
// no GET /conversations (ver db.js), então os chips do cartão não pedem chamada extra por contato.
//
// Etapas: cada canal pode ter sua própria lista (ver pipelineEstagiosPara em lib/api.ts — só o
// número principal da Felizcred tem o funil de empréstimo PIPELINE_ESTAGIOS, qualquer outro canal
// usa PIPELINE_ESTAGIOS_GENERICO). O quadro mostra UMA lista de colunas por vez — a do canal
// selecionado na barra lateral — e bucketa todas as conversas (de todos os canais, já que os
// dados agora vêm merged) contra essa lista. Na prática o time fica parado no canal principal
// (que tem o funil de verdade); trocar de canal na barra lateral troca o "vocabulário" das
// colunas, não filtra os dados — o seletor continua útil, só muda de papel nessa tela.
//
// "Prioridade" no cartão não é campo novo — é calculado: contato esperando resposta (última
// mensagem foi dele) há mais de 2h vira "Prioridade", 24h vira "Urgente". "Cartão parado" (âmbar)
// é outro cálculo: mais tempo que o limiar CONFIGURADO por etapa (clique no rodapé da coluna)
// sem mudar de etapa (`pipeline_estagio_desde`) — o mesmo limiar que alimenta o alerta automático
// no servidor (nota na conversa + sugestão pendente em Retornos).
//
// O quadro é interativo: clicar num cartão (sem arrastar) abre um painel de resposta rápida ao
// lado, sem sair do Pipeline. Pra mídia, busca no histórico ou resposta pronta, "Ver conversa
// completa" ainda manda pra aba Conversas de verdade.

const AVATAR_CORES = ["#111214", "#2F6FED", "#7C5CFC", "#D9476B", "#15803D", "#B45309", "#0E7490"]

function corAvatar(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_CORES[h % AVATAR_CORES.length]
}

function iniciais(nome: string | null, phone: string) {
  const base = (nome || phone).trim()
  const partes = base.split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function horaRelativa(ts: number | null) {
  if (!ts) return ""
  const diffMin = Math.round((Date.now() - ts) / 60000)
  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  return `${Math.round(diffH / 24)}d`
}

function formatHora(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function camposDe(conversa: Conversation): Record<string, string> {
  if (!conversa.campos_json) return {}
  try {
    return JSON.parse(conversa.campos_json)
  } catch {
    return {}
  }
}

function tagsDe(conversa: Conversation): { id: number; nome: string; cor: string }[] {
  if (!conversa.tags_json) return []
  try {
    return JSON.parse(conversa.tags_json)
  } catch {
    return []
  }
}

// Campo "Valor solicitado" é texto livre (a pessoa digita "6500", "R$ 6.500" etc.) — parse
// tolerante: trata vírgula como separador decimal brasileiro quando presente.
function parseValorReais(raw: string | undefined): number {
  if (!raw) return 0
  const limpo = raw.replace(/[^\d,.-]/g, "")
  if (!limpo) return 0
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo
  const n = parseFloat(normalizado)
  return Number.isFinite(n) ? n : 0
}

function formatReais(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

const LIMIAR_PRIORIDADE_MIN = 120 // 2h esperando resposta
const LIMIAR_URGENTE_MIN = 24 * 60 // 24h esperando resposta

// Limiar de "parado na etapa" por etapa — configurável pelo painel (clique no rodapé da coluna,
// ver footerNote/onFooterNoteClick abaixo), guardado em `pipeline_alertas_config`
// (db.js/server.js), o mesmo valor que alimenta o alerta por IA que já roda sozinho em segundo
// plano (nota na conversa + sugestão pendente em Retornos quando o cartão passa do limiar).
function formatarDuracaoMin(minutos: number): string {
  if (minutos < 60) return `${minutos}min`
  if (minutos % 1440 === 0) return `${minutos / 1440}d`
  if (minutos % 60 === 0) return `${minutos / 60}h`
  if (minutos < 1440) return `${(minutos / 60).toFixed(1)}h`
  return `${(minutos / 1440).toFixed(1)}d`
}

// Chave única do cartão (cruza canais): o mesmo telefone pode existir em MAIS de um canal (ex.:
// contato que já escreveu pro WhatsApp principal e também pro Instagram) — usar só `phone` como
// id colidia entre canais. Mesmo padrão de chave composta já usado em contatos.tsx (`chaveDe`), e
// bate com o formato de chave que unread-context.tsx usa (`business_number_id|phone`, com
// business_number_id === "instagram" pro canal Instagram).
function chaveTask(conversa: Conversation): string {
  return `${conversa.business_number_id}|${conversa.phone}`
}

// Nomes de campo personalizado priorizados no cartão — mesma lista canônica de contatos.tsx
// (CAMPOS_PRIORIDADE), menos "Responsável"/"Produto"/"Origem" que já ganham chip próprio aqui e
// "Valor solicitado" que tem parse/formatação de moeda dedicados.
function conversaParaTask(
  conversa: Conversation,
  notificacao: { naoLida: boolean; urgente: boolean },
  canal: Channel | undefined,
  limiarMinutos: number | undefined,
): KanbanTask {
  const aguardandoResposta = conversa.last_direction === "in"
  const elapsedMin = conversa.last_message_at ? (Date.now() - conversa.last_message_at) / 60000 : null
  const campos = camposDe(conversa)

  let priority: KanbanTask["priority"] | undefined
  if (aguardandoResposta && elapsedMin != null) {
    if (elapsedMin >= LIMIAR_URGENTE_MIN) priority = "urgent"
    else if (elapsedMin >= LIMIAR_PRIORIDADE_MIN) priority = "high"
  }

  // próxima ação: espera resposta nossa > etapa parada além do limiar configurado > nada. Etapa
  // sem limiar configurado nunca fica "parada" aqui (ver EditarAlertaDialog mais abaixo pra
  // configurar).
  let proximaAcao: string | undefined
  if (aguardandoResposta && conversa.last_message_at) {
    proximaAcao = `⏱ Sem resposta há ${horaRelativa(conversa.last_message_at)}`
  }
  const desde = conversa.pipeline_estagio_desde || conversa.last_message_at
  const minutosNaEtapa = desde ? (Date.now() - desde) / 60000 : 0
  const parado = !!limiarMinutos && minutosNaEtapa >= limiarMinutos
  if (!proximaAcao && parado && desde) proximaAcao = `⚠ Parado há ${horaRelativa(desde)}`

  // Canal sempre visível no cartão — agora que o Pipeline cruza TODOS os canais num quadro só,
  // é a única forma de saber de qual número/canal veio cada contato.
  const chips: { id: string; nome: string; cor: string }[] = []
  for (const tag of tagsDe(conversa)) chips.push({ id: `tag-${tag.id}`, nome: tag.nome, cor: tag.cor })
  if (campos["Responsável"]) chips.push({ id: "responsavel", nome: campos["Responsável"], cor: "#475569" })
  if (campos["Origem"]) chips.push({ id: "origem", nome: campos["Origem"], cor: "#6B7F7A" })
  if (campos["Produto"]) chips.push({ id: "produto", nome: campos["Produto"], cor: "#7C5CFC" })
  const valorNum = parseValorReais(campos["Valor solicitado"])
  if (valorNum > 0) chips.push({ id: "valor", nome: formatReais(valorNum), cor: "#2F7D4F" })

  return {
    id: chaveTask(conversa),
    title: conversa.name || conversa.phone,
    note: proximaAcao,
    priority,
    tags: chips,
    people: [{ name: conversa.name || conversa.phone, color: corAvatar(conversa.phone) }],
    due: desde ? `há ${horaRelativa(desde)}` : undefined,
    stale: parado,
    unread: notificacao.naoLida,
    unreadBlink: notificacao.urgente,
    authBlink: ETAPAS_AGUARDANDO_AUTORIZACAO.includes(conversa.clt_etapa || ""),
    channelKind: canal?.kind || "whatsapp",
  }
}

// Etapas em que o cliente já recebeu o link de autorização (Unnotech ou Facta) e ainda não autorizou.
const ETAPAS_AGUARDANDO_AUTORIZACAO = ["autorizacao_enviada", "aguardando_autorizacao"]

function construirColunas(
  conversas: Conversation[],
  estagios: ReturnType<typeof pipelineEstagiosPara>,
  identidade: Identidade | null,
  unreadConversations: Set<string>,
  channels: Channel[],
  alertasConfig: Record<string, number>,
  onEditarAlerta: (estagioId: string) => void,
): KanbanColumn[] {
  const primeiraEtapaId = estagios[0]?.id ?? "novo"
  return estagios.map((estagio) => {
    const nessaEtapa = conversas.filter((c) => (c.pipeline_estagio || primeiraEtapaId) === estagio.id)
    const somaValores = nessaEtapa.reduce((acc, c) => acc + parseValorReais(camposDe(c)["Valor solicitado"]), 0)
    const limiarMinutos = alertasConfig[estagio.id]
    return {
      id: estagio.id,
      name: estagio.nome,
      dotColor: estagio.cor,
      subtitle: somaValores > 0 ? formatReais(somaValores) : undefined,
      footerNote: limiarMinutos
        ? `⚡ Avisa se parado por mais de ${formatarDuracaoMin(limiarMinutos)} nesta etapa`
        : "Sem alerta configurado nesta etapa — clique pra ativar",
      onFooterNoteClick: () => onEditarAlerta(estagio.id),
      tasks: nessaEtapa.map((c) => {
        // Mesma fonte que chats.tsx usa pra "não lida" (unread-context.tsx, poll de 5s) — bate
        // com o que a conversa mostra na aba Conversas, sem precisar de outro polling aqui.
        const naoLida = unreadConversations.has(chaveTask(c))
        return conversaParaTask(
          c,
          { naoLida, urgente: naoLida && conversaEhUrgente(c, identidade) },
          channels.find((ch) => ch.id === c.business_number_id),
          limiarMinutos,
        )
      }),
    }
  })
}

// Painel de resposta rápida — fica ao lado do quadro, sem navegar pra aba Conversas. Cobre o
// caso comum de "vi o card, preciso responder rapidinho" sem perder o contexto do funil. Pra
// mídia (áudio, anexo, resposta pronta, etc.) ou busca no histórico, o link "Ver conversa
// completa" ainda manda pra aba Conversas de verdade.
function PainelConversa({
  businessId,
  conversa,
  onClose,
  onAbrirCompleta,
}: {
  businessId: string
  conversa: Conversation
  onClose: () => void
  onAbrirCompleta: (phone: string) => void
}) {
  const [mensagens, setMensagens] = React.useState<Message[]>([])
  const [carregando, setCarregando] = React.useState(true)
  const [texto, setTexto] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Janela de 24h só (mesmo espírito do chats.tsx) — esse painel é pra resposta rápida, não pra
  // ler histórico antigo (quem precisar disso já tem o link "Ver conversa completa" logo abaixo,
  // que abre a aba Conversas de verdade com paginação por dia). Evita puxar a conversa inteira a
  // cada 4s pra um contato com meses de histórico.
  const carregarMensagens = React.useCallback(() => {
    api
      .messages(businessId, conversa.phone, { desde: Date.now() - 24 * 60 * 60 * 1000 })
      .then(setMensagens)
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [businessId, conversa.phone])

  React.useEffect(() => {
    setCarregando(true)
    carregarMensagens()
    // Pausa sozinho com a aba em segundo plano (mesmo motivo de chats.tsx) — esse painel só
    // existe enquanto alguém está de olho nele na tela.
    const id = setInterval(() => {
      if (document.hidden) return
      carregarMensagens()
    }, 4000)
    return () => clearInterval(id)
  }, [carregarMensagens])

  React.useEffect(() => {
    api.marcarLida(businessId, conversa.phone).catch(() => {})
  }, [businessId, conversa.phone])

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [mensagens])

  async function enviar() {
    const valor = texto.trim()
    if (!valor || enviando) return
    setEnviando(true)
    try {
      await api.reply(businessId, conversa.phone, valor)
      setTexto("")
      carregarMensagens()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="w-[380px] shrink-0 border-l bg-background flex flex-col h-full">
      <div className="h-14 px-3 flex items-center gap-2 border-b shrink-0">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
          style={{ background: corAvatar(conversa.phone) }}
        >
          {iniciais(conversa.name, conversa.phone)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{conversa.name || "Sem nome"}</p>
          <p className="text-[11px] text-muted-foreground">{conversa.phone}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          title="Ver conversa completa"
          onClick={() => onAbrirCompleta(conversa.phone)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {carregando ? (
          <p className="text-xs text-muted-foreground text-center py-6">Carregando...</p>
        ) : mensagens.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhuma mensagem ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {mensagens.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words ${
                  m.direction === "out"
                    ? "bg-primary text-primary-foreground self-end"
                    : "bg-secondary text-secondary-foreground self-start"
                }`}
              >
                {m.type === "image" && m.media_path && (
                  <img src={mediaUrl(m.media_path)} alt="" className="rounded mb-1 max-w-[240px] max-h-[280px] w-auto h-auto object-contain" />
                )}
                {m.type === "audio" && m.media_path && (
                  <audio src={mediaUrl(m.media_path)} controls className="mb-1 max-w-[240px] w-full" />
                )}
                {m.type === "document" && m.media_path && (
                  <a
                    href={mediaUrl(m.media_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 mb-1 rounded bg-black/10 px-2 py-1.5 hover:bg-black/20"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate underline min-w-0 flex-1">{m.body || "Documento"}</span>
                  </a>
                )}
                {(m.type !== "document" || !m.media_path) && m.body}
                <div className="text-[9px] opacity-70 mt-0.5 text-right">{formatHora(m.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2.5 border-t shrink-0 flex items-end gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Responder..."
          className="min-h-9 flex-1 resize-none text-sm"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              enviar()
            }
          }}
        />
        <Button size="icon" onClick={enviar} disabled={enviando || !texto.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// Editar o limiar de alerta "parado na etapa" — atalho de edição do tempo que a equipe quer ser
// avisada, direto no rodapé da coluna. Unidade livre (minutos/horas/dias) na hora de digitar, mas
// sempre convertido e guardado em minutos (ver pipeline_alertas_config, db.js) — cobre tanto o
// caso rápido (15min) quanto o lento (70h) sem ambiguidade.
function EditarAlertaDialog({
  estagioId,
  estagioNome,
  valorAtualMinutos,
  onClose,
  onSalvo,
}: {
  estagioId: string
  estagioNome: string
  valorAtualMinutos: number | undefined
  onClose: () => void
  onSalvo: (estagioId: string, minutos: number | null) => void
}) {
  const [unidade, setUnidade] = React.useState<"minutos" | "horas" | "dias">(
    !valorAtualMinutos ? "horas" : valorAtualMinutos % 1440 === 0 ? "dias" : valorAtualMinutos % 60 === 0 ? "horas" : "minutos",
  )
  const [valor, setValor] = React.useState<string>(() => {
    if (!valorAtualMinutos) return ""
    if (valorAtualMinutos % 1440 === 0) return String(valorAtualMinutos / 1440)
    if (valorAtualMinutos % 60 === 0) return String(valorAtualMinutos / 60)
    return String(valorAtualMinutos)
  })
  const [salvando, setSalvando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  async function salvar() {
    const n = Number(valor)
    if (!valor.trim() || !Number.isFinite(n) || n <= 0) return setErro("Digite um número maior que zero")
    const minutos = unidade === "minutos" ? n : unidade === "horas" ? n * 60 : n * 1440
    setSalvando(true)
    setErro(null)
    try {
      await api.pipelineAlertaConfigDefinir(estagioId, minutos)
      onSalvo(estagioId, minutos)
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar")
    } finally {
      setSalvando(false)
    }
  }

  async function desativar() {
    setSalvando(true)
    setErro(null)
    try {
      await api.pipelineAlertaConfigDefinir(estagioId, null)
      onSalvo(estagioId, null)
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao desativar")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Avisar quando parado em "{estagioNome}"</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground -mt-1">
            Quando um contato ficar nessa etapa por mais tempo que isso, a IA gera um alerta sozinha (nota na conversa
            + entra em "Sugestões pendentes" na tela Retornos) e o cartão pisca aqui no Pipeline.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ex.: 15"
              className="w-24"
              autoFocus
            />
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value as "minutos" | "horas" | "dias")}
              className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="minutos">minutos</option>
              <option value="horas">horas</option>
              <option value="dias">dias</option>
            </select>
          </div>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </div>
        <DialogFooter className="flex-row sm:justify-between">
          {valorAtualMinutos ? (
            <Button variant="ghost" size="sm" onClick={desativar} disabled={salvando} className="text-muted-foreground">
              Desativar alerta
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PipelinePage({ onAbrirConversa }: { onAbrirConversa: (channelId: string, phone: string) => void }) {
  const { current, channels, setCurrent } = useChannel()
  const { setActiveConversation, markConversationSeen, unreadConversations } = useUnread()
  const { identidade } = useAuth()
  const [conversas, setConversas] = React.useState<Conversation[]>([])
  const [carregando, setCarregando] = React.useState(true)
  const [selecionada, setSelecionada] = React.useState<Conversation | null>(null)
  const [alertasConfig, setAlertasConfig] = React.useState<Record<string, number>>({})
  const [editandoAlertaEstagio, setEditandoAlertaEstagio] = React.useState<string | null>(null)

  const labelFunil = current?.company === "felizcred"
    ? channels.find((c) => c.company === "felizcred" && c.kind === "whatsapp")?.label
    : current?.label
  const estagios = pipelineEstagiosPara(labelFunil)

  React.useEffect(() => {
    api.pipelineAlertasConfig().then(setAlertasConfig).catch(() => {})
  }, [])

  // Cross-canal (pedido real: "pipeline integrado em tudo com todos os canais") — busca TODOS os
  // canais de uma vez (inclusive Instagram, que antes era bloqueado nessa tela) em vez de só o
  // selecionado na barra lateral, e junta num quadro só. `chaveTask` (acima) evita colisão quando
  // o mesmo telefone aparece em mais de um canal.
  const carregar = React.useCallback(() => {
    if (!channels.length || !current) return
    const canaisDaEmpresa = channels.filter((c) => c.company === current.company && c.kind !== "site")
    setCarregando(true)
    const site = current.company === "felizcred"
      ? api.siteChatConversas().then((lista) => lista.map((c): Conversation => ({
          phone: c.id, business_number_id: "site", name: c.name, email: c.contact,
          status: c.status === "closed" ? "resolvido" : "novo", last_message_at: c.updated_at,
          last_body: c.last_message || null,
          last_direction: c.last_visitor_at && (!c.last_agent_at || c.last_visitor_at > c.last_agent_at) ? "in" : "out",
          nota: null, fluxo_passo: null, pipeline_estagio: c.pipeline_estagio,
          pipeline_estagio_desde: c.pipeline_estagio_desde, channel: "site", nao_lida: c.unread,
          clt_etapa: c.status === "closed" ? null : c.clt_etapa,
          tags_json: c.produto_tag ? JSON.stringify([{ id: -1, nome: c.produto_tag, cor: "#15803D" }]) : null,
        }))).catch(() => [])
      : Promise.resolve([] as Conversation[])
    Promise.all([Promise.all(canaisDaEmpresa.map((c) => api.conversations(c.id).catch(() => [] as Conversation[]))), site])
      .then(([listasWhats, siteLista]) => {
        const whats = listasWhats.flat()
        // Site e WhatsApp do mesmo cliente se encerram juntos: lead do site encerrado sai do quadro.
        // Um cartão do site por celular (o mais recente): quem abriu o chat várias vezes não repete no quadro.
        const fimTel = (v: string | null | undefined) => (v || "").replace(/\D/g, "").slice(-8)
        const vistos = new Set<string>()
        const siteVisivel = [...siteLista]
          .sort((a, b) => (b.last_message_at ?? 0) - (a.last_message_at ?? 0))
          .filter((c) => c.status !== "resolvido")
          .filter((c) => {
            const k = fimTel(c.email) || c.phone
            if (vistos.has(k)) return false
            vistos.add(k)
            return true
          })
        setConversas([...whats, ...siteVisivel])
      })
      .finally(() => setCarregando(false))
  }, [channels, current])

  React.useEffect(() => {
    carregar()
  }, [carregar])

  // Mesmo mecanismo do ChatsPage: enquanto o painel de resposta rápida está aberto, a conversa
  // conta como "sendo olhada agora" — não deve disparar som/notificação de mensagem nova. Usa o
  // canal DA CONVERSA selecionada (business_number_id), não mais o canal "atual" da barra
  // lateral — o Pipeline cruza todos os canais agora, a conversa aberta pode ser de qualquer um.
  React.useEffect(() => {
    setActiveConversation(selecionada?.business_number_id ?? null, selecionada?.phone ?? null)
    return () => setActiveConversation(null, null)
  }, [selecionada, setActiveConversation])

  React.useEffect(() => {
    if (!selecionada) return
    markConversationSeen(selecionada.business_number_id, selecionada.phone)
  }, [selecionada, markConversationSeen])

  // Referência estável enquanto `conversas`/`estagios` não mudam de verdade, senão o
  // KanbanBoard re-sincroniza o estado interno a cada render e desfaz um reordenar dentro da
  // mesma coluna que o usuário acabou de fazer (ver efeito de sync em kanban-board.tsx).
  const columns = React.useMemo(
    () =>
      construirColunas(
        conversas,
        estagios,
        identidade,
        unreadConversations,
        channels,
        alertasConfig,
        setEditandoAlertaEstagio,
      ),
    [conversas, estagios, identidade, unreadConversations, channels, alertasConfig],
  )

  function abrirPorId(chave: string) {
    const conversa = conversas.find((c) => chaveTask(c) === chave)
    if (!conversa) return
    if (conversa.business_number_id === "site") {
      const canalSite = channels.find((c) => c.id === "site")
      if (canalSite) setCurrent(canalSite)
      onAbrirConversa("site", conversa.phone)
      return
    }
    setSelecionada(conversa)
  }

  const primeiraEtapaId = estagios[0]?.id ?? "novo"

  // Otimista: acha o card cuja coluna nova diverge do estágio salvo, atualiza na hora, confirma
  // depois. Se o PATCH falhar, recarrega do servidor pra não deixar o quadro mentindo. Conversa
  // sem pipeline_estagio no banco é tratada como se já estivesse na 1ª etapa (ver
  // construirColunas) — só grava de verdade quando o estágio realmente muda. `task.id` é a chave
  // composta canal+telefone (ver chaveTask) — usa o canal DA CONVERSA pro PATCH, não mais um
  // canal "atual" global (o quadro mistura conversas de vários canais agora).
  function onBoardChange(next: KanbanColumn[]) {
    for (const col of next) {
      for (const task of col.tasks) {
        const conversa = conversas.find((c) => chaveTask(c) === task.id)
        const estagioAtual = conversa?.pipeline_estagio || primeiraEtapaId
        if (conversa && estagioAtual !== col.id) {
          setConversas((prev) =>
            prev.map((c) => (chaveTask(c) === task.id ? { ...c, pipeline_estagio: col.id, pipeline_estagio_desde: Date.now() } : c)),
          )
          const salvar = conversa.business_number_id === "site"
            ? api.siteChatPipeline(conversa.phone, col.id)
            : api.setPipeline(conversa.business_number_id, conversa.phone, col.id)
          salvar.catch(() => carregar())
          return
        }
      }
    }
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <div className="h-14 px-4 flex items-center justify-between border-b shrink-0">
        <div>
          <p className="font-semibold text-sm">Pipeline</p>
          <p className="text-xs text-muted-foreground">
            Todos os canais · {conversas.length} contato{conversas.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={carregar} disabled={carregando} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex-1 min-w-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden p-4">
          <KanbanBoard columns={columns} onChange={onBoardChange} onTaskClick={abrirPorId} label="Pipeline" />
        </div>

        {selecionada && (
          <PainelConversa
            businessId={selecionada.business_number_id}
            conversa={selecionada}
            onClose={() => setSelecionada(null)}
            onAbrirCompleta={(phone) => onAbrirConversa(selecionada.business_number_id, phone)}
          />
        )}
      </div>

      {editandoAlertaEstagio && (
        <EditarAlertaDialog
          estagioId={editandoAlertaEstagio}
          estagioNome={estagios.find((e) => e.id === editandoAlertaEstagio)?.nome || editandoAlertaEstagio}
          valorAtualMinutos={alertasConfig[editandoAlertaEstagio]}
          onClose={() => setEditandoAlertaEstagio(null)}
          onSalvo={(estagioId, minutos) =>
            setAlertasConfig((prev) => {
              const next = { ...prev }
              if (minutos) next[estagioId] = minutos
              else delete next[estagioId]
              return next
            })
          }
        />
      )}
    </div>
  )
}
