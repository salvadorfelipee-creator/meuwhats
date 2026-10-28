import type { PresencaSite } from "@/lib/api"

const PAGINAS: [RegExp, string][] = [
  [/^\/app\/?$/, "no app da simulação"],
  [/^\/minha-simulacao/, "acompanhando a simulação"],
  [/^\/proposta/, "na proposta"],
  [/^\/blog/, "lendo o blog"],
  [/^\/guia/, "lendo um guia"],
  [/^\/?$/, "na página inicial"],
]

export function paginaDoCliente(pagina?: string | null) {
  if (!pagina) return ""
  return PAGINAS.find(([r]) => r.test(pagina))?.[1] || `em ${pagina}`
}

export function tempoAtras(ms: number) {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60_000))
  if (min < 1) return "agora há pouco"
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  return h < 24 ? `há ${h} h` : `há ${Math.floor(h / 24)} d`
}

// Presença do cliente no site: "Online agora · no app da simulação" ou "Saiu do site há 3 min". Sem dado, não mostra nada.
export function textoPresenca(p?: PresencaSite | null) {
  if (!p) return null
  if (p.online) return { online: true, texto: ["Online agora", paginaDoCliente(p.pagina)].filter(Boolean).join(" · ") }
  return p.saiu_em ? { online: false, texto: `Saiu do site ${tempoAtras(p.saiu_em)}` } : null
}

export function PresencaSiteTag({ presenca, className = "" }: { presenca?: PresencaSite | null; className?: string }) {
  const t = textoPresenca(presenca)
  if (!t) return null
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${t.online ? "font-medium text-emerald-600" : "text-muted-foreground"} ${className}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${t.online ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
      {t.texto}
    </span>
  )
}
