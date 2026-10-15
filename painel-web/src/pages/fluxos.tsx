import * as React from "react"
import { api } from "@/lib/api"
import { ITENS_ROTEADOR, CANAIS_ROTEADOR, type BolhaRoteador, type ItemRoteador } from "@/lib/roteador-producao"
import { SidebarTrigger } from "@/components/blocks/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Workflow,
  CheckCircle2,
  Circle as CircleIcon,
  Megaphone,
  Package,
  HelpCircle,
  UserRound,
  Bell,
  RefreshCcw,
  Siren,
  Smartphone,
} from "lucide-react"

// Tela "Fluxos" — documentação SOMENTE LEITURA dos fluxos de atendimento automático que já estão
// em produção em server.js, pro time revisar o texto/lógica real do bot (um número por canal:
// Felizcred principal, Campanha CLT, Cota Certa, Ciahot). Port do mesmo padrão já usado no
// painel da Especitá (whatsapp especita/painel-web/src/pages/fluxos.tsx), só que aqui documenta
// os fluxos da própria Felizcred — e, DE PROPÓSITO, sem a parte do motor de fluxo dinâmico
// guardado no banco ("fluxos_dinamicos"/"Criar fluxo rápido") que existe lá: isso é uma
// ferramenta separada, não usada hoje, fora do escopo desta tela.
//
// "Revisado": nem todo item listado aqui já foi auditado de verdade pelo time — cada item mostra
// um selo ✓ revisado / ⏳ pendente, marcado manualmente (ver api.roteadorRevisadoListar/
// roteadorRevisadoDefinir), pra nunca confundir "existe no código" com "alguém já confirmou que
// o texto/lógica estão certos".

const GRUPOS_ORDEM = ["Entrada", "Urgência", "Produto", "FAQ", "Direto ao humano", "Campanha", "Lembrete", "Retorno"] as const

const ICONE_GRUPO: Record<(typeof GRUPOS_ORDEM)[number], typeof Workflow> = {
  Entrada: Megaphone,
  Urgência: Siren,
  Produto: Package,
  FAQ: HelpCircle,
  "Direto ao humano": UserRound,
  Campanha: Megaphone,
  Lembrete: Bell,
  Retorno: RefreshCcw,
}

const TODOS = "__todos__"

export function FluxosPage() {
  const [canalFiltro, setCanalFiltro] = React.useState<string>(TODOS)
  const [selecionado, setSelecionado] = React.useState<ItemRoteador>(ITENS_ROTEADOR[0])
  const [revisado, setRevisado] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    api.roteadorRevisadoListar().then(setRevisado).catch(() => {})
  }, [])

  const itensFiltrados = React.useMemo(
    () => (canalFiltro === TODOS ? ITENS_ROTEADOR : ITENS_ROTEADOR.filter((i) => i.canal === canalFiltro)),
    [canalFiltro],
  )

  const porGrupo = React.useMemo(() => {
    const m = new Map<string, ItemRoteador[]>()
    for (const item of itensFiltrados) m.set(item.grupo, [...(m.get(item.grupo) || []), item])
    return m
  }, [itensFiltrados])

  // Se o item selecionado some do filtro atual (trocou de canal), seleciona o 1º item visível
  // em vez de deixar a coluna 2 mostrando algo que não está mais na lista.
  React.useEffect(() => {
    if (!itensFiltrados.some((i) => i.chave === selecionado.chave) && itensFiltrados.length) {
      setSelecionado(itensFiltrados[0])
    }
  }, [itensFiltrados, selecionado.chave])

  async function alternarRevisado(chave: string) {
    const novo = !revisado[chave]
    setRevisado((prev) => ({ ...prev, [chave]: novo }))
    try {
      await api.roteadorRevisadoDefinir(chave, novo)
    } catch {
      setRevisado((prev) => ({ ...prev, [chave]: !novo }))
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="h-14 px-4 flex items-center gap-2 border-b shrink-0">
        <SidebarTrigger />
        <div>
          <p className="font-semibold text-sm">Fluxos</p>
          <p className="text-xs text-muted-foreground">Atendimento automático por número — só visualização</p>
        </div>
      </div>

      {/* Filtro de canal — pills, um por número/canal + "Todos" */}
      <div className="px-4 py-2.5 border-b flex items-center gap-1.5 flex-wrap shrink-0">
        <button
          onClick={() => setCanalFiltro(TODOS)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
            canalFiltro === TODOS ? "bg-primary text-primary-foreground border-transparent" : "text-muted-foreground border-border hover:bg-accent"
          }`}
        >
          Todos os canais
        </button>
        {CANAIS_ROTEADOR.map((canal) => (
          <button
            key={canal}
            onClick={() => setCanalFiltro(canal)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              canalFiltro === canal ? "bg-primary text-primary-foreground border-transparent" : "text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            {canal}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Coluna 1 — lista de fluxos, agrupada */}
        <div className="w-80 shrink-0 border-r overflow-y-auto p-3 flex flex-col gap-5">
          {GRUPOS_ORDEM.map((grupo) => {
            const itens = porGrupo.get(grupo) || []
            if (!itens.length) return null
            const IconeGrupo = ICONE_GRUPO[grupo]
            return (
              <div key={grupo} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1.5">
                  <IconeGrupo className="h-3 w-3" />
                  {grupo}
                </div>
                {itens.map((item) => {
                  const ativo = selecionado.chave === item.chave
                  const foiRevisado = Boolean(revisado[item.chave])
                  return (
                    <div
                      key={item.chave}
                      className={`group flex items-center gap-1 rounded-lg transition-colors ${
                        ativo ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                      }`}
                    >
                      <button onClick={() => setSelecionado(item)} className="flex-1 min-w-0 text-left px-2.5 py-2 text-xs">
                        <p className="font-medium truncate">{item.titulo}</p>
                        <p className={`truncate ${ativo ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{item.canal}</p>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          alternarRevisado(item.chave)
                        }}
                        title={foiRevisado ? "Marcar como pendente de revisão" : "Marcar como revisado"}
                        className={`shrink-0 mr-1.5 h-6 w-6 rounded-md flex items-center justify-center transition-colors ${
                          ativo ? "hover:bg-white/15" : "hover:bg-background"
                        }`}
                      >
                        {foiRevisado ? (
                          <CheckCircle2 className={`h-4 w-4 ${ativo ? "text-primary-foreground" : "text-emerald-600"}`} />
                        ) : (
                          <CircleIcon
                            className={`h-4 w-4 ${ativo ? "text-primary-foreground/50" : "text-muted-foreground/40"}`}
                            strokeDasharray="3 2"
                          />
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {!itensFiltrados.length && (
            <p className="text-xs text-muted-foreground px-1.5">Nenhum fluxo documentado pra esse canal.</p>
          )}
        </div>

        {/* Coluna 2 — detalhe: descrição + simulação de celular */}
        <div className="flex-1 overflow-y-auto">
          <DetalheItem item={selecionado} revisado={Boolean(revisado[selecionado.chave])} onAlternarRevisado={() => alternarRevisado(selecionado.chave)} />
        </div>
      </div>
    </div>
  )
}

function DetalheItem({
  item,
  revisado,
  onAlternarRevisado,
}: {
  item: ItemRoteador
  revisado: boolean
  onAlternarRevisado: () => void
}) {
  const [indice, setIndice] = React.useState(0)
  React.useEffect(() => setIndice(0), [item.chave])
  const caminho = item.caminhos[Math.min(indice, item.caminhos.length - 1)]

  return (
    <div className="p-6 max-w-5xl flex flex-col lg:flex-row gap-8">
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-base font-semibold">{item.titulo}</h2>
          <Button
            size="sm"
            variant={revisado ? "secondary" : "outline"}
            onClick={onAlternarRevisado}
            className="shrink-0 gap-1.5"
          >
            {revisado ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <CircleIcon className="h-3.5 w-3.5" />}
            {revisado ? "Revisado" : "Marcar como revisado"}
          </Button>
        </div>
        <div className="flex items-center gap-1.5 mb-4">
          <Badge variant="secondary">{item.canal}</Badge>
          <Badge variant="outline">{item.grupo}</Badge>
        </div>
        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{item.descricao}</p>
      </div>

      <div className="flex flex-col gap-3 items-center lg:w-[320px] shrink-0">
        {item.caminhos.length > 1 && (
          <div className="flex flex-wrap gap-1.5 justify-center px-1">
            {item.caminhos.map((c, i) => (
              <button
                key={i}
                onClick={() => setIndice(i)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  i === indice ? "bg-[#25D366] text-[#0b141a] border-transparent font-medium" : "text-muted-foreground border-border hover:bg-accent"
                }`}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
        )}

        <div className="w-[300px] rounded-[32px] border-[8px] border-[#1b2620] bg-[#ECE5DD] shadow-xl overflow-hidden">
          <div className="bg-[#075E54] text-white px-3 py-2.5 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">F</div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Felipe · Felizcred</p>
              <p className="text-[10px] opacity-80">{item.canal}</p>
            </div>
          </div>
          <div className="h-[460px] overflow-y-auto px-2.5 py-3 flex flex-col gap-1.5">
            {item.intro.map((b, i) => (
              <BolhaView key={`intro-${i}`} bolha={b} />
            ))}
            {caminho?.linhas.map((b, i) => <BolhaView key={`c-${i}`} bolha={b} />)}
          </div>
          <div className="bg-[#F0F0F0] px-3 py-2 text-xs text-[#999] border-t">Mensagem</div>
        </div>
        {!item.intro.length && !item.caminhos.length && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5" /> Sem transcrição de exemplo pra este item.
          </div>
        )}
      </div>
    </div>
  )
}

function BolhaView({ bolha }: { bolha: BolhaRoteador }) {
  if (bolha.tipo === "nota") {
    return (
      <div className="self-center text-[10px] text-[#3F5551] bg-[#DDE7E3] rounded-full px-2.5 py-1 text-center max-w-[90%]">
        🤖 {bolha.texto}
      </div>
    )
  }
  const out = bolha.tipo === "eu"
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-[13px] whitespace-pre-line shadow-sm ${
          out ? "bg-[#DCF8C6] text-[#1E2B24] rounded-tr-sm" : "bg-white text-[#1E2B24] rounded-tl-sm"
        }`}
      >
        {bolha.texto}
      </div>
    </div>
  )
}
