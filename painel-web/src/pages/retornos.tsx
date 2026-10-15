import * as React from "react"
import { api, type RetornoComContato, type SugestaoRetorno } from "@/lib/api"
import { useChannel } from "@/lib/channel-context"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/blocks/sidebar"
import { CalendarClock, Phone, AtSign as InstagramIcon, Trash2, MessageCircle, Sparkles, Check, X } from "lucide-react"

// Rótulo + motivo curto por tipo de sugestão — port de whatsapp especita/painel-web/src/pages/
// retornos.tsx. Diferença da Felizcred: não existe o tipo "jornada_upsell" (jornada pós-
// procedimento é coisa de clínica, não foi portada) nem "inatividade_reforco" (2º toque) — o
// tipo SugestaoRetorno aqui só tem "etapa_parada" | "inatividade" (ver lib/api.ts).
const SUGESTAO_TIPO_LABEL: Record<SugestaoRetorno["tipo"], string> = {
  etapa_parada: "Etapa parada",
  inatividade: "Cliente sumiu",
}

// Fila de retornos (lembrete agendado por conversa) — junta TODOS os canais numa lista só, em
// vez de precisar abrir conversa por conversa pra ver o que está agendado. Poll de 30s, mesmo
// intervalo do badge "Atribuídas a mim".

type Grupo = "atrasado" | "hoje" | "semana" | "adiante"

// Mesmo truque de fuso (-3h e lê os campos UTC) usado em server.js/agenda.js/pipeline.tsx pra
// trabalhar no "relógio de Brasília" sem depender do fuso do processo.
function diaBrt(ts: number): string {
  const brt = new Date(ts - 3 * 60 * 60 * 1000)
  return `${brt.getUTCFullYear()}-${brt.getUTCMonth()}-${brt.getUTCDate()}`
}

function agruparRetorno(dataAgendada: number, agora: number): Grupo {
  if (dataAgendada < agora) return "atrasado"
  if (diaBrt(dataAgendada) === diaBrt(agora)) return "hoje"
  if (dataAgendada - agora <= 7 * 24 * 60 * 60 * 1000) return "semana"
  return "adiante"
}

const GRUPO_LABEL: Record<Grupo, string> = {
  atrasado: "Atrasados",
  hoje: "Hoje",
  semana: "Esta semana",
  adiante: "Mais adiante",
}

const GRUPO_COR: Record<Grupo, string> = {
  atrasado: "#C03C3C",
  hoje: "#B8690F",
  semana: "#2F7D4F",
  adiante: "#6B7F7A",
}

function formatarData(ts: number) {
  return new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export function RetornosPage({ onAbrirConversa }: { onAbrirConversa: (channelId: string, phone: string) => void }) {
  const { channels } = useChannel()
  const [itens, setItens] = React.useState<RetornoComContato[]>([])
  const [carregando, setCarregando] = React.useState(true)
  const [cancelandoId, setCancelandoId] = React.useState<number | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  // Sugestões pendentes — ver SUGESTAO_TIPO_LABEL acima. Carregadas separado dos retornos já
  // confirmados (fonte de dados diferente), mesmo poll de 30s.
  const [sugestoes, setSugestoes] = React.useState<SugestaoRetorno[]>([])
  const [processandoId, setProcessandoId] = React.useState<number | null>(null)

  const carregar = React.useCallback(() => {
    api
      .retornosPendentes()
      .then((lista) => {
        setItens(lista)
        setErro(null)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar retornos"))
      .finally(() => setCarregando(false))
    api.sugestoesRetornoPendentes().then(setSugestoes).catch(() => {})
  }, [])

  React.useEffect(() => {
    carregar()
    // Pausa com a aba em segundo plano (mesmo princípio de chats.tsx) — ninguém está vendo essa
    // lista enquanto o navegador está minimizado/noutra aba.
    const id = setInterval(() => {
      if (!document.hidden) carregar()
    }, 30000)
    return () => clearInterval(id)
  }, [carregar])

  // "Aprovar" nunca agenda sozinho — leva pro atendente escolher template/canal na conversa de
  // verdade (mesmo princípio de sempre: IA sugere, pessoa decide). Some da lista assim que clica.
  async function aprovarSugestao(s: SugestaoRetorno) {
    setProcessandoId(s.id)
    try {
      await api.sugestaoRetornoMarcarStatus(s.id, "aprovado")
      setSugestoes((prev) => prev.filter((x) => x.id !== s.id))
      onAbrirConversa(s.business_id, s.phone)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao aprovar sugestão")
    } finally {
      setProcessandoId(null)
    }
  }

  async function descartarSugestao(id: number) {
    setProcessandoId(id)
    try {
      await api.sugestaoRetornoMarcarStatus(id, "descartado")
      setSugestoes((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao descartar sugestão")
    } finally {
      setProcessandoId(null)
    }
  }

  function rotuloCanal(businessId: string) {
    return channels.find((c) => c.id === businessId)?.label || businessId
  }

  async function cancelar(id: number) {
    setCancelandoId(id)
    try {
      await api.cancelarRetorno(id)
      setItens((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao cancelar")
    } finally {
      setCancelandoId(null)
    }
  }

  const agora = Date.now()
  const grupos: Grupo[] = ["atrasado", "hoje", "semana", "adiante"]
  const porGrupo: Record<Grupo, RetornoComContato[]> = { atrasado: [], hoje: [], semana: [], adiante: [] }
  for (const item of itens) porGrupo[agruparRetorno(item.data_agendada, agora)].push(item)
  for (const g of grupos) porGrupo[g].sort((a, b) => a.data_agendada - b.data_agendada)

  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CalendarClock className="h-5 w-5" /> Retornos
            </h1>
            <p className="text-sm text-muted-foreground">Lembretes agendados por conversa, de todos os canais juntos.</p>
          </div>
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {carregando && itens.length === 0 && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!carregando && itens.length === 0 && sugestoes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum retorno pendente agora — fila vazia. 🎉</p>
        )}

        {/* Sugestões pendentes — vêm da IA (etapa parada) ou do radar de inatividade, ainda não
            viraram um retorno de verdade. "Analisar na conversa" leva pra conversa escolher
            template/canal; "Descartar" só remove a sugestão, não afeta nada no CRM. Texto
            explicativo deixa claro que isso NÃO é uma mensagem agendada ainda, é só um alerta de
            "vale a pena falar com esse contato", pra não confundir com a lista de mensagens já
            agendadas logo abaixo (mesmo ajuste de texto feito no fork, 13/10/2026). */}
        {sugestoes.length > 0 && (
          <div className="rounded-xl border border-[#C9B8F0] bg-[#F1ECFB]/40 dark:bg-violet-950/10 dark:border-violet-800">
            <div className="px-4 py-3 border-b border-[#C9B8F0] dark:border-violet-800">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm flex items-center gap-2 text-[#6D4BD6] dark:text-violet-400">
                  <Sparkles className="h-4 w-4" /> Sugestões — ainda não são mensagens agendadas
                </p>
                <span className="text-xs text-muted-foreground">{sugestoes.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                A IA (ou o tempo parado) identificou que vale a pena falar com esses contatos de novo.
                Nada foi enviado ainda — clique em "Analisar na conversa" pra decidir o que e quando
                mandar; só depois disso o contato entra na lista de "Mensagens agendadas" logo abaixo.
              </p>
            </div>
            <div className="flex flex-col">
              {sugestoes.map((s) => (
                <div key={s.id} className="px-4 py-2.5 border-b last:border-b-0 border-[#C9B8F0]/60 dark:border-violet-800/60 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {s.name || s.phone}{" "}
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6D4BD6] dark:text-violet-400">
                        {SUGESTAO_TIPO_LABEL[s.tipo]}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{rotuloCanal(s.business_id)} · {s.motivo}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-[#6D4BD6] hover:bg-[#5d3fc0] text-white gap-1"
                      disabled={processandoId === s.id}
                      onClick={() => aprovarSugestao(s)}
                      title='Abre a conversa pra você escolher o texto/modelo — ainda não agenda nada sozinho'
                    >
                      <Check className="h-3.5 w-3.5" /> Analisar na conversa
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={processandoId === s.id}
                      onClick={() => descartarSugestao(s.id)}
                      title="Descartar sugestão"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {itens.length > 0 && (
          <p className="text-sm font-semibold flex items-center gap-2 -mb-2">
            <CalendarClock className="h-4 w-4" /> Mensagens agendadas
          </p>
        )}

        {grupos
          .filter((g) => porGrupo[g].length > 0)
          .map((g) => (
            <div key={g} className="rounded-xl border">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <p className="font-semibold text-sm flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: GRUPO_COR[g] }} />
                  {GRUPO_LABEL[g]}
                </p>
                <span className="text-xs text-muted-foreground">{porGrupo[g].length}</span>
              </div>
              <div className="flex flex-col">
                {porGrupo[g].map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-2.5 border-b last:border-b-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      {r.channel === "instagram" ? (
                        <InstagramIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.name || r.phone}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {rotuloCanal(r.business_id)} · {r.tipo} · {formatarData(r.data_agendada)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => onAbrirConversa(r.business_id, r.phone)}
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Abrir
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={cancelandoId === r.id}
                        onClick={() => cancelar(r.id)}
                        title="Cancelar retorno"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
