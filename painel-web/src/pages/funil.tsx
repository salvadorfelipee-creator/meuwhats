import * as React from "react"
import { api, type FunilResponse } from "@/lib/api"
import { Button } from "@/components/ui/button"

const PERIODOS = [7, 30] as const
const NOMES_ETAPA: Record<string, string> = {
  entrada: "Entrada no chat", inicio: "Entrada no chat", solicitando_autorizacao: "Enviando autorização",
  autorizacao_enviada: "Aguardando autorização", ofertas_disponiveis: "Escolhendo condição",
  dados_pessoais: "Preenchendo proposta", aguardando_assinatura_facta: "Aguardando assinatura",
  proposta_em_analise: "Em análise", proposta_concluida: "Concluída", erro_autorizacao: "Erro na autorização",
  erro_integracao: "Falha técnica", sem_oferta: "Sem oferta", sem_margem: "Sem margem",
  nao_elegivel: "Não elegível", politica_reprovada: "Política reprovada", proposta_cancelada: "Proposta encerrada",
}
const NOMES_MOTIVO: Record<string, string> = {
  menos_de_3_meses: "Menos de 3 meses de registro", erro_autorizacao: "Autorização não enviada",
  politica_reprovada: "Política de crédito", sem_oferta: "Facta sem oferta", proposta_cancelada: "Proposta encerrada",
  pedido_repetido: "Pediu atendimento novamente",
}

function FunilEtapas({ etapas }: { etapas: { label: string; total: number }[] }) {
  const max = Math.max(...etapas.map((e) => e.total), 1)
  return (
    <div className="flex flex-col gap-3">
      {etapas.map((e, i) => {
        const anterior = i > 0 ? etapas[i - 1].total : null
        const taxa = anterior && anterior > 0 ? Math.round((e.total / anterior) * 100) : null
        return (
          <div key={e.label}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm">{e.label}</span>
              <span className="text-sm font-semibold">
                {e.total}
                {taxa !== null && <span className="text-xs text-muted-foreground font-normal ml-1">({taxa}%)</span>}
              </span>
            </div>
            <div className="h-6 rounded-md bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary rounded-md transition-all"
                style={{ width: `${Math.max((e.total / max) * 100, e.total > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function FunilPage() {
  const [dias, setDias] = React.useState<(typeof PERIODOS)[number]>(7)
  const [dados, setDados] = React.useState<FunilResponse | null>(null)

  const carregar = React.useCallback((d: number) => {
    api.funilResumo(d).then(setDados).catch(() => {})
  }, [])

  React.useEffect(() => {
    carregar(dias)
  }, [dias, carregar])

  const organico = dados
    ? [
        { label: "Escolheu CLT no menu", total: dados.etapas.clt_menu_escolhido },
        { label: "Confirmou 3+ meses de carteira", total: dados.etapas.clt_qualificado },
        { label: "Enviou os dados completos", total: dados.etapas.clt_dados_completos },
      ]
    : []

  const campanha = dados
    ? [
        { label: "Clicou em \"Quero simular\"", total: dados.etapas.campanha_clique },
        { label: "Enviou os dados completos", total: dados.etapas.campanha_dados_completos },
      ]
    : []

  const site = dados
    ? [
        { label: "Entraram no CLT", total: dados.site?.etapas.entrada || 0 },
        { label: "Confirmaram 3+ meses", total: dados.site?.etapas.qualificado || 0 },
        { label: "Enviaram CPF e consentimento", total: dados.site?.etapas.dados_minimos_enviados || 0 },
        { label: "Receberam autorização Facta", total: dados.site?.etapas.autorizacao_enviada || 0 },
        { label: "Receberam oferta", total: dados.site?.etapas.oferta_disponivel || 0 },
        { label: "Criaram proposta", total: dados.site?.etapas.proposta_criada || 0 },
        { label: "Concluíram", total: dados.site?.etapas.proposta_concluida || 0 },
      ]
    : []

  return (
    <div className="h-screen overflow-y-auto">
      <div className="h-14 px-4 flex items-center justify-between border-b shrink-0">
        <p className="font-semibold text-sm">Funil de consignado CLT</p>
        <div className="flex gap-1">
          {PERIODOS.map((p) => (
            <Button key={p} size="sm" variant={dias === p ? "default" : "outline"} onClick={() => setDias(p)}>
              {p} dias
            </Button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-3xl flex flex-col gap-10">
        <section>
          <div className="mb-3">
            <p className="text-sm font-semibold">Chat do site · Facta ativa</p>
            <p className="text-xs text-muted-foreground">Novo Saque e Unnotech permanecem em espera e não entram nas tentativas.</p>
          </div>
          <FunilEtapas etapas={site} />
        </section>

        <section>
          <p className="text-sm font-semibold mb-3">Onde os clientes estão parando</p>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground"><tr><th className="text-left font-medium px-3 py-2">Etapa atual</th><th className="text-right font-medium px-3 py-2">Clientes</th><th className="text-right font-medium px-3 py-2">Sem responder há 30 min</th></tr></thead>
              <tbody>{(dados?.site?.paradas || []).map((item) => <tr key={item.etapa} className="border-t"><td className="px-3 py-2">{NOMES_ETAPA[item.etapa] || item.etapa}</td><td className="px-3 py-2 text-right font-medium">{item.total}</td><td className="px-3 py-2 text-right">{item.silenciosos}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        {!!dados?.site?.motivos?.length && <section>
          <p className="text-sm font-semibold mb-3">Motivos de saída</p>
          <div className="flex flex-col divide-y border-y">{dados.site.motivos.map((item) => <div key={item.motivo} className="flex justify-between py-2 text-sm"><span>{NOMES_MOTIVO[item.motivo] || item.motivo}</span><b>{item.total}</b></div>)}</div>
        </section>}

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Funil orgânico — quem chega pelo menu do WhatsApp
          </p>
          <FunilEtapas etapas={organico} />
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Funil da campanha — quem responde ao template de marketing
          </p>
          <FunilEtapas etapas={campanha} />
        </div>

        <p className="text-xs text-muted-foreground">
          Contagem de pessoas únicas por etapa dentro dos últimos {dias} dias. A % é a
          conversão em relação à etapa anterior.
        </p>
      </div>
    </div>
  )
}
