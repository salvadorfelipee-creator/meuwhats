import * as React from "react"
import { api, type Conversation, type RetornoComContato } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Plus, Radio, MessageCircle, CalendarClock } from "lucide-react"

// Tela inicial depois do login — resumo do dia sem precisar abrir Conversas/Pipeline pra saber
// o que precisa de atenção. Port de whatsapp especita/painel-web/src/pages/hoje.tsx (redesign
// 05/10/2026, docs/redesign seção 4), adaptado pra terminologia de empréstimo da Felizcred.
//
// Diferença de desenho em relação ao fork: lá a tela era presa ao canal selecionado na barra
// lateral (api.conversations(current.id)) porque o negócio tinha só 1 número de WhatsApp. Aqui
// a Felizcred tem vários números + Instagram, e uma tela "resumo do dia" só faz sentido olhando
// o negócio inteiro de uma vez — por isso usamos api.inbox() (mesmo endpoint cross-canal que
// unread-context.tsx já usa pro badge de não-lidas), sem depender do seletor de canal.
//
// "Consultas hoje" do fork (agenda de clínica) não existe aqui — trocado por "Retornos vencendo
// hoje", que usa api.retornosPendentes() (fila de lembrete agendado por conversa, já cross-canal
// também).

// Mesmo truque de fuso usado em server.js/agenda.js/pipeline.tsx: desloca -3h e lê os campos
// UTC, dá o "relógio de Brasília" sem depender do fuso do processo/navegador.
function diaBrt(ts: number): string {
  const brt = new Date(ts - 3 * 60 * 60 * 1000)
  return `${brt.getUTCFullYear()}-${brt.getUTCMonth()}-${brt.getUTCDate()}`
}

function horaBrt(ts: number): string {
  const brt = new Date(ts - 3 * 60 * 60 * 1000)
  return `${String(brt.getUTCHours()).padStart(2, "0")}:${String(brt.getUTCMinutes()).padStart(2, "0")}`
}

function camposDe(c: Conversation): Record<string, string> {
  if (!c.campos_json) return {}
  try {
    return JSON.parse(c.campos_json)
  } catch {
    return {}
  }
}

// Qual "canal" (id usado por abrirConversa/useUnread) essa conversa pertence — mesma regra que
// unread-context.tsx usa pra montar a chave de conversa cross-canal.
function canalDe(c: Conversation): string {
  return c.channel === "instagram" ? "instagram" : c.business_number_id
}

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

function horaRelativa(ts: number | null) {
  if (!ts) return ""
  const diffMin = Math.round((Date.now() - ts) / 60000)
  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  return `${Math.round(diffH / 24)}d`
}

function saudacao(): string {
  const h = new Date().getHours()
  if (h < 12) return "Bom dia"
  if (h < 18) return "Boa tarde"
  return "Boa noite"
}

const DATA_HOJE = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })

// Etapa do funil (ver PIPELINE_ESTAGIOS em lib/api.ts) que representa "dinheiro parado esperando
// decisão" — equivalente ao "orçamento parado" da clínica (proposta já em andamento, mas sem
// avançar). Escolhida "em análise" (proposta já enviada pro banco, aguardando aprovação) em vez
// de "documentos enviados" porque é aí que o valor solicitado já está definido e a demora pesa
// mais pro cliente.
const ESTAGIO_PROPOSTA_PARADA = "analise"
const DIAS_PROPOSTA_PARADA = 3

function CardNumero({
  titulo,
  valor,
  subtitulo,
  cor,
}: {
  titulo: string
  valor: number | string
  subtitulo: string
  cor: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-1" style={{ borderLeftWidth: 4, borderLeftColor: cor }}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-[26px] font-bold leading-none tabular-nums">{valor}</p>
      <p className="text-[11px] text-muted-foreground">{subtitulo}</p>
    </div>
  )
}

export function HojePage({
  onAbrirConversa,
  onIrParaConversas,
}: {
  onAbrirConversa: (channelId: string, phone: string) => void
  onIrParaConversas: () => void
}) {
  const { identidade } = useAuth()
  const meuNome = identidade?.nome || ""
  const [conversas, setConversas] = React.useState<Conversation[]>([])
  const [retornos, setRetornos] = React.useState<RetornoComContato[]>([])
  const [carregando, setCarregando] = React.useState(true)

  const carregar = React.useCallback(() => {
    setCarregando(true)
    api
      .inbox()
      .then(setConversas)
      .catch(() => {})
      .finally(() => setCarregando(false))
    // Separado do Promise acima de propósito: se a fila de retornos falhar, o resto da tela
    // (sem resposta/propostas paradas) continua funcionando normalmente — só a lista de
    // retornos de hoje fica vazia.
    api
      .retornosPendentes()
      .then(setRetornos)
      .catch(() => setRetornos([]))
  }, [])

  React.useEffect(() => {
    carregar()
    // Pausa com a aba em segundo plano (mesmo princípio de chats.tsx).
    const id = setInterval(() => {
      if (!document.hidden) carregar()
    }, 15000)
    return () => clearInterval(id)
  }, [carregar])

  const hojeStr = diaBrt(Date.now())
  const retornosHoje = retornos
    .filter((r) => diaBrt(r.data_agendada) === hojeStr)
    .sort((a, b) => a.data_agendada - b.data_agendada)

  const semResposta = conversas.filter((c) => c.last_direction === "in")

  const propostasParadas = conversas.filter((c) => {
    if (c.pipeline_estagio !== ESTAGIO_PROPOSTA_PARADA) return false
    const desde = c.pipeline_estagio_desde || c.last_message_at
    return desde && (Date.now() - desde) / 86400000 >= DIAS_PROPOSTA_PARADA
  })
  const somaPropostasParadas = propostasParadas.reduce((acc, c) => acc + parseValorReais(camposDe(c)["Valor solicitado"]), 0)

  const seteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000
  const novosNaSemana = conversas.filter((c) => c.last_message_at && c.last_message_at >= seteDiasAtras && !c.pipeline_estagio)
  const origens = novosNaSemana.map((c) => camposDe(c)["Origem"]).filter(Boolean) as string[]
  const origemMaisComum =
    origens.length > 0
      ? Object.entries(origens.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o]: (acc[o] || 0) + 1 }), {})).sort(
          (a, b) => b[1] - a[1],
        )[0]
      : null

  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold">
              {saudacao()}
              {meuNome ? `, ${meuNome}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground capitalize">{DATA_HOJE}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onIrParaConversas}>
              <Plus className="h-3.5 w-3.5" /> Nova conversa
            </Button>
            <Button size="sm" className="gap-1.5" onClick={onIrParaConversas}>
              <Radio className="h-3.5 w-3.5" /> Enviar campanha
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CardNumero titulo="Sem resposta" valor={semResposta.length} subtitulo="aguardando retorno nosso" cor="#C03C3C" />
          <CardNumero
            titulo="Retornos vencendo hoje"
            valor={retornosHoje.length}
            subtitulo={retornosHoje.length ? `primeiro às ${horaBrt(retornosHoje[0].data_agendada)}` : "nenhum marcado"}
            cor="#2F7D4F"
          />
          <CardNumero
            titulo="Propostas paradas"
            valor={propostasParadas.length}
            subtitulo={somaPropostasParadas > 0 ? `${formatReais(somaPropostasParadas)} há mais de ${DIAS_PROPOSTA_PARADA} dias` : `há mais de ${DIAS_PROPOSTA_PARADA} dias`}
            cor="#B8690F"
          />
          <CardNumero
            titulo="Novos na semana"
            valor={novosNaSemana.length}
            subtitulo={origemMaisComum ? `maioria via ${origemMaisComum[0]}` : "últimos 7 dias"}
            cor="#2F7D4F"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="font-semibold text-sm">Retornos vencendo hoje</p>
              <span className="text-xs text-muted-foreground">{retornosHoje.length}</span>
            </div>
            <div className="flex flex-col">
              {carregando && retornosHoje.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Carregando...</p>}
              {!carregando && retornosHoje.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum retorno marcado pra hoje.</p>
              )}
              {retornosHoje.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onAbrirConversa(r.business_id, r.phone)}
                  className="px-4 py-2.5 border-b last:border-b-0 hover:bg-accent/50 text-left flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.name || r.phone}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.tipo}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#2F7D4F] shrink-0">{horaBrt(r.data_agendada)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="font-semibold text-sm">Precisam de resposta</p>
              <span className="text-xs text-muted-foreground">{semResposta.length} esperando</span>
            </div>
            <div className="flex flex-col">
              {carregando && semResposta.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Carregando...</p>}
              {!carregando && semResposta.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">Ninguém esperando resposta agora 🎉</p>
              )}
              {semResposta.slice(0, 8).map((c) => (
                <button
                  key={`${canalDe(c)}:${c.phone}`}
                  onClick={() => onAbrirConversa(canalDe(c), c.phone)}
                  className="px-4 py-2.5 border-b last:border-b-0 hover:bg-accent/50 text-left flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name || c.phone}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.last_body}</p>
                  </div>
                  <span className="text-xs font-semibold text-[#C03C3C] shrink-0">{horaRelativa(c.last_message_at)}</span>
                </button>
              ))}
            </div>
            {semResposta.length > 0 && (
              <button onClick={onIrParaConversas} className="w-full text-center py-2 text-xs text-primary hover:underline border-t">
                Abrir Conversas →
              </button>
            )}
          </div>

          <div className="rounded-xl border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="font-semibold text-sm">Propostas aguardando</p>
              <span className="text-xs text-muted-foreground">{propostasParadas.length}</span>
            </div>
            <div className="flex flex-col">
              {propostasParadas.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma proposta parada — bom sinal.</p>
              )}
              {propostasParadas.slice(0, 8).map((c) => {
                const campos = camposDe(c)
                const desde = c.pipeline_estagio_desde || c.last_message_at
                const dias = desde ? Math.floor((Date.now() - desde) / 86400000) : 0
                const valor = parseValorReais(campos["Valor solicitado"])
                return (
                  <button
                    key={`${canalDe(c)}:${c.phone}`}
                    onClick={() => onAbrirConversa(canalDe(c), c.phone)}
                    className="px-4 py-2.5 border-b last:border-b-0 hover:bg-accent/50 text-left flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name || c.phone}</p>
                        {valor > 0 && <p className="text-xs text-muted-foreground">{formatReais(valor)}</p>}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#B8690F] shrink-0">
                      {dias} dia{dias === 1 ? "" : "s"}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
