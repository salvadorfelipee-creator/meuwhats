import * as React from "react"
import {
  api,
  pipelineEstagiosPara,
  type BroadcastContact,
  type BroadcastResult,
  type Tag,
  type TemplateInfo,
} from "@/lib/api"
import { useChannel } from "@/lib/channel-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Assistente de 3 passos pra "Campanhas WhatsApp" (porte do mesmo wizard construído pra Especitá,
// ver whatsapp especita/painel-web/src/pages/campanha-whatsapp-wizard.tsx). Não reinventa envio em
// massa — passo 3 só monta o `contacts` certo e chama o POST /broadcast que já existe (ver
// BroadcastDialog em chats.tsx, "Campanha" nas Conversas), a novidade de verdade é o passo 1
// (segmentação por etapa/etiqueta/aniversário em vez de colar telefone por telefone).
//
// Diferença proposital em relação à versão da Especitá: esta aqui NÃO tem o dropdown "conectar a
// um fluxo" do passo 2 — dono do negócio pediu pra não portar automação de fluxo nesta rodada.
//
// Etapa do pipeline (passo 1): a Felizcred tem um funil próprio só no número principal
// (PIPELINE_ESTAGIOS, ver pipelineEstagiosPara em lib/api.ts); qualquer outra conta usa a lista
// genérica. O wizard troca de lista dinamicamente conforme a conta escolhida no próprio diálogo.
//
// Custo por mensagem (passo 3): ~R$0,035 — valor citado pelo usuário a partir da mudança de
// cobrança por mensagem de serviço da própria API oficial do WhatsApp em 01/10/2026. É só uma
// estimativa pra dar noção de ordem de grandeza — sem lógica de orçamento/limite travando o envio
// nesta primeira versão (pedido explícito do dono do negócio).
const CUSTO_POR_MENSAGEM_BRL = 0.035

type Passo = 1 | 2 | 3

export function CampanhaWhatsAppWizard({
  open,
  onOpenChange,
  contaIdFixa,
  contatosFixos,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Pré-selecionados direto da tela Contatos — pula o passo 1 (segmentação por filtro) de
  // propósito: quando a pessoa já escolheu quem quer mandar à mão (checkbox por checkbox),
  // recalcular por etapa/tag de novo seria ignorar a escolha dela.
  contaIdFixa?: string
  contatosFixos?: BroadcastContact[]
}) {
  const { channels } = useChannel()
  const contas = React.useMemo(() => channels.filter((c) => c.kind === "whatsapp"), [channels])
  const [contaId, setContaId] = React.useState("")
  const [passo, setPasso] = React.useState<Passo>(contatosFixos ? 2 : 1)

  const contaSelecionada = React.useMemo(() => contas.find((c) => c.id === contaId), [contas, contaId])
  const estagiosDisponiveis = React.useMemo(
    () => pipelineEstagiosPara(contaSelecionada?.label),
    [contaSelecionada],
  )

  // ── Passo 1 — segmentação (etapa do pipeline E/OU tag E/OU aniversário, tudo opcional) ────
  const [tags, setTags] = React.useState<Tag[]>([])
  const [estagio, setEstagio] = React.useState("")
  const [tagId, setTagId] = React.useState("")
  const [usarAniversario, setUsarAniversario] = React.useState(false)
  const [aniversarioDias, setAniversarioDias] = React.useState("7")
  const [contatos, setContatos] = React.useState<BroadcastContact[]>([])
  const [contando, setContando] = React.useState(false)
  const [erroContagem, setErroContagem] = React.useState<string | null>(null)

  // ── Passo 2 — mensagem (template aprovado + preview opcional do corpo) ──────────────────────
  const [templates, setTemplates] = React.useState<TemplateInfo[]>([])
  const [templatesCarregando, setTemplatesCarregando] = React.useState(false)
  const [templatesErro, setTemplatesErro] = React.useState<string | null>(null)
  const [templateNome, setTemplateNome] = React.useState("")
  const [bodyPreview, setBodyPreview] = React.useState("")

  // ── Passo 3 — revisão e envio ──────────────────────────────────────────────────────────────
  const [espacar, setEspacar] = React.useState(false)
  const [intervaloSegundos, setIntervaloSegundos] = React.useState("30")
  const [enviando, setEnviando] = React.useState(false)
  const [resumo, setResumo] = React.useState<string | null>(null)
  const [falhas, setFalhas] = React.useState<BroadcastResult[]>([])

  // Reseta tudo quando o diálogo fecha — reabrir não deve mostrar resultado/erro do envio anterior.
  React.useEffect(() => {
    if (open) return
    setPasso(contatosFixos ? 2 : 1)
    setEstagio("")
    setTagId("")
    setUsarAniversario(false)
    setAniversarioDias("7")
    setContatos(contatosFixos || [])
    setErroContagem(null)
    setTemplateNome("")
    setBodyPreview("")
    setEspacar(false)
    setIntervaloSegundos("30")
    setResumo(null)
    setFalhas([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  React.useEffect(() => {
    if (!open || contaId) return
    if (contaIdFixa) setContaId(contaIdFixa)
    else if (contas.length) setContaId(contas[0].id)
  }, [open, contaId, contas, contaIdFixa])

  React.useEffect(() => {
    if (!open || !contaId) return
    api.tags(contaId).then(setTags).catch(() => {})
  }, [open, contaId])

  React.useEffect(() => {
    if (!open || !contaId) return
    setTemplatesCarregando(true)
    setTemplatesErro(null)
    api
      .templates(contaId)
      .then(({ templates }) => setTemplates(templates))
      .catch((err) => setTemplatesErro(err instanceof Error ? err.message : "Erro ao carregar templates"))
      .finally(() => setTemplatesCarregando(false))
  }, [open, contaId])

  const contar = React.useCallback(() => {
    if (!contaId) return
    setContando(true)
    setErroContagem(null)
    api
      .campanhaContatos(contaId, {
        estagio: estagio || undefined,
        tagId: tagId ? Number(tagId) : undefined,
        aniversarioDias: usarAniversario ? Number(aniversarioDias) || 7 : undefined,
      })
      .then((r) => setContatos(r.contacts))
      .catch((err) => setErroContagem(err instanceof Error ? err.message : "Erro ao contar destinatários"))
      .finally(() => setContando(false))
  }, [contaId, estagio, tagId, usarAniversario, aniversarioDias])

  // Conta de novo sempre que um filtro muda, enquanto o diálogo estiver aberto — é o "live
  // count" pedido (dá pra ver o impacto do filtro antes mesmo de ir pro passo 2). Pulado
  // quando veio com contatosFixos — a lista já é a escolha final, não um filtro pra recalcular.
  React.useEffect(() => {
    if (!open || contatosFixos) return
    contar()
  }, [open, contar, contatosFixos])

  const templateSelecionado = templates.find((t) => t.name === templateNome)
  const custoEstimado = contatos.length * CUSTO_POR_MENSAGEM_BRL

  async function enviar() {
    if (!contaId || !templateNome || !contatos.length) return
    setEnviando(true)
    setResumo(null)
    setFalhas([])
    try {
      const intervalSeconds = espacar ? Number(intervaloSegundos) || 0 : 0
      const { resultados, agendados } = await api.broadcast(contaId, {
        template: templateNome,
        language: templateSelecionado?.language || "pt_BR",
        contacts: contatos,
        bodyPreview: bodyPreview || undefined,
        intervalSeconds: intervalSeconds > 0 ? intervalSeconds : undefined,
      })
      const ok = resultados.filter((r) => r.ok).length
      const partes = [`${ok} enviada(s) agora.`]
      if (resultados.length - ok > 0) partes.push(`${resultados.length - ok} falharam.`)
      if (agendados) partes.push(`${agendados} agendada(s) com o intervalo escolhido.`)
      setResumo(partes.join(" "))
      setFalhas(resultados.filter((r) => !r.ok))
    } catch (err) {
      setResumo(err instanceof Error ? err.message : "Erro ao enviar")
    } finally {
      setEnviando(false)
    }
  }

  function fechar(valor: boolean) {
    if (enviando) return
    onOpenChange(valor)
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Campanha de WhatsApp</DialogTitle>
        </DialogHeader>

        {contatosFixos ? (
          <p className="text-sm rounded-md border px-3 py-2 bg-muted/30">
            Enviando pra <strong>{contatosFixos.length}</strong> contato(s) selecionado(s) na tela Contatos.
          </p>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
            {([1, 2, 3] as Passo[]).map((p, i) => (
              <React.Fragment key={p}>
                {i > 0 && <span className="text-muted-foreground/50">›</span>}
                <span
                  className={
                    p === passo
                      ? "px-2 py-0.5 rounded-full bg-primary text-primary-foreground"
                      : p < passo
                      ? "px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800"
                      : "px-2 py-0.5 rounded-full"
                  }
                >
                  {p === 1 ? "1 · Segmentação" : p === 2 ? "2 · Mensagem" : "3 · Revisão e envio"}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {contas.length > 1 && (
          <div>
            <label className="text-sm font-medium mb-1 block">Enviar de</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {passo === 1 && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Etapa do pipeline</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={estagio}
                onChange={(e) => setEstagio(e.target.value)}
              >
                <option value="">Qualquer etapa</option>
                {estagiosDisponiveis.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Etiqueta (tag)</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={tagId}
                onChange={(e) => setTagId(e.target.value)}
              >
                <option value="">Qualquer etiqueta</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-1">
                <input type="checkbox" checked={usarAniversario} onChange={(e) => setUsarAniversario(e.target.checked)} />
                Faz aniversário em breve
              </label>
              {usarAniversario && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Nos próximos</span>
                  <Input
                    type="number"
                    min={1}
                    value={aniversarioDias}
                    onChange={(e) => setAniversarioDias(e.target.value)}
                    className="w-20 h-8"
                  />
                  <span className="text-sm text-muted-foreground">dias</span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Usa o campo "Data de nascimento" dos detalhes do contato (preencha lá antes de usar esse filtro).
              </p>
            </div>
            <div className="rounded-md border px-3 py-2 bg-muted/30">
              {contando ? (
                <p className="text-sm text-muted-foreground">Contando destinatários...</p>
              ) : erroContagem ? (
                <p className="text-sm text-destructive">{erroContagem}</p>
              ) : (
                <p className="text-sm">
                  <strong>{contatos.length}</strong> contato(s) encontrado(s) com esse filtro.
                </p>
              )}
            </div>
          </div>
        )}

        {passo === 2 && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Template (aprovado na Meta)</label>
              {templatesErro ? (
                <p className="text-sm text-destructive">Não consegui carregar os templates: {templatesErro}</p>
              ) : (
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                  value={templateNome}
                  onChange={(e) => setTemplateNome(e.target.value)}
                  disabled={templatesCarregando || !templates.length}
                >
                  <option value="">
                    {templatesCarregando
                      ? "Carregando..."
                      : templates.length
                      ? "Escolha um template"
                      : "Nenhum template aprovado encontrado"}
                  </option>
                  {templates.map((t) => (
                    <option key={`${t.name}-${t.language}`} value={t.name}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Texto de pré-visualização (opcional — use {"{{1}}"} onde o template espera o nome)
              </label>
              <Textarea
                value={bodyPreview}
                onChange={(e) => setBodyPreview(e.target.value)}
                rows={3}
                placeholder="Oi {{1}}! Fazia tempo que a gente não se falava..."
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Só guia o que aparece no histórico da conversa — o conteúdo de verdade é o do template aprovado.
              </p>
            </div>
          </div>
        )}

        {passo === 3 && (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border px-3 py-2">
              <p className="text-sm">
                <strong>{contatos.length}</strong> destinatário(s) · template <strong>{templateNome || "—"}</strong>
              </p>
              {bodyPreview && <p className="text-xs text-muted-foreground mt-1">"{bodyPreview}"</p>}
            </div>
            <div className="rounded-md border px-3 py-2 bg-muted/30">
              <p className="text-sm">
                Estimativa de custo: {contatos.length} × R$ 0,035 ≈{" "}
                <strong>R$ {custoEstimado.toFixed(2).replace(".", ",")}</strong>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Valor aproximado (cobrança por mensagem de serviço da API oficial do WhatsApp) — sem limite/bloqueio
                automático nesta versão, é só pra referência.
              </p>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-1">
                <input type="checkbox" checked={espacar} onChange={(e) => setEspacar(e.target.checked)} />
                Espaçar os envios em vez de mandar tudo de uma vez
              </label>
              {espacar && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={intervaloSegundos}
                    onChange={(e) => setIntervaloSegundos(e.target.value)}
                    className="w-24 h-8"
                  />
                  <span className="text-sm text-muted-foreground">segundos entre cada mensagem</span>
                </div>
              )}
            </div>
            {resumo && <p className="text-sm">{resumo}</p>}
            {falhas.length > 0 && (
              <ul className="text-xs text-destructive space-y-0.5 max-h-24 overflow-y-auto">
                {falhas.map((f, i) => (
                  <li key={i}>
                    {f.phone}: {f.error || "falhou"}
                  </li>
                ))}
              </ul>
            )}
            {resumo && !enviando && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={falhas.length === 0 ? "success" : "warning"}>
                  {falhas.length === 0 ? "Tudo certo" : `${falhas.length} com erro`}
                </Badge>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => setPasso((p) => (p === 1 ? 1 : ((p - 1) as Passo)))}
            disabled={passo === 1 || enviando || (!!contatosFixos && passo === 2)}
          >
            Voltar
          </Button>
          {passo < 3 ? (
            <Button onClick={() => setPasso((p) => ((p + 1) as Passo))} disabled={passo === 2 && !templateNome}>
              Continuar
            </Button>
          ) : (
            <Button onClick={enviar} disabled={enviando || !contatos.length || !templateNome}>
              {enviando ? "Enviando..." : "Enviar campanha"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
