import * as React from "react"
import { api, type FunilResponse } from "@/lib/api"
import { Button } from "@/components/ui/button"

const PERIODOS = [7, 30] as const

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

      <div className="p-4 max-w-xl flex flex-col gap-8">
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
