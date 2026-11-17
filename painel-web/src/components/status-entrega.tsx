import { AlertCircle, Check, CheckCheck, Clock } from "lucide-react"

// Estado de entrega de uma mensagem NOSSA (saída) no WhatsApp — o mesmo visual em toda a lista
// de conversas e dentro do balão, pra bater o olho e saber se a mensagem chegou:
//   enviada (1 risco cinza) → entregue (2 riscos cinza) → lida (2 riscos azuis) | não entregue (vermelho).
// `claro` = ícone sobre fundo verde de balão (cores mais escuras); sem ele, sobre fundo neutro da lista.
export function rotuloEntrega(status?: string | null, erro?: string | null) {
  switch (status) {
    case "read":
      return "Lida"
    case "delivered":
      return "Entregue"
    case "sent":
      return "Enviada — ainda não confirmou a entrega no celular"
    case "failed":
      return `Não entregue${erro ? `: ${erro}` : ""}`
    default:
      return "Enviando…"
  }
}

export function StatusEntrega({
  status,
  erro,
  tamanho = 14,
  comTexto = false,
}: {
  status?: string | null
  erro?: string | null
  tamanho?: number
  comTexto?: boolean
}) {
  const titulo = rotuloEntrega(status, erro)
  const estilo = { width: tamanho, height: tamanho }
  let icone: React.ReactNode
  let cor: string
  let texto: string
  if (status === "read") {
    icone = <CheckCheck style={estilo} strokeWidth={2.4} />
    cor = "text-[#34a8e6]"
    texto = "Lida"
  } else if (status === "delivered") {
    icone = <CheckCheck style={estilo} strokeWidth={2.4} />
    cor = "text-[#667781] dark:text-[#8696a0]"
    texto = "Entregue"
  } else if (status === "sent") {
    icone = <Check style={estilo} strokeWidth={2.4} />
    cor = "text-[#667781] dark:text-[#8696a0]"
    texto = "Enviada"
  } else if (status === "failed") {
    icone = <AlertCircle style={estilo} strokeWidth={2.4} />
    cor = "text-red-600 dark:text-red-400"
    texto = "Não entregue"
  } else {
    icone = <Clock style={estilo} strokeWidth={2.4} />
    cor = "text-[#667781] dark:text-[#8696a0]"
    texto = "Enviando"
  }
  return (
    <span title={titulo} className={`inline-flex items-center gap-0.5 shrink-0 ${cor}`}>
      {icone}
      {comTexto && <span className="text-[10px] font-semibold leading-none">{texto}</span>}
    </span>
  )
}
