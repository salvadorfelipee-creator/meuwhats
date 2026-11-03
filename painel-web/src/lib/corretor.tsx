import * as React from "react"
import { api } from "@/lib/api"

// Autocorreção silenciosa: só o que é inequívoco (acento, vírgula/pontuação, maiúscula) ou um
// errinho de digitação numa palavra só. Tudo que mexe em número ou em mais de uma palavra segue
// como balão clicável.
function semAcento(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
}

function distanciaEdicao(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

export function correcaoEhSimples({ errado, certo }: { errado: string; certo: string }) {
  if (/\d/.test(errado) || /\d/.test(certo)) return false
  const a = semAcento(errado)
  const b = semAcento(certo)
  if (!a || !b) return false
  if (a === b) return true
  const umaPalavra = (s: string) => !/\s/.test(s.trim())
  if (!umaPalavra(errado) || !umaPalavra(certo)) return false
  return distanciaEdicao(a, b) <= (Math.min(a.length, b.length) >= 5 ? 2 : 1)
}

// ── Corretor por-trecho: balões posicionados em cima da palavra/expressão errada ──────────────
//
// Técnica: um <div> "espelho" invisível, absolutamente posicionado em cima do próprio textarea
// (mesmo left/top/width/height, mesma fonte/padding/borda — copiados do computed style), com o
// MESMO texto quebrando exatamente do mesmo jeito. Insere um <span> marcador em volta de cada
// trecho "errado" e mede a posição desse span (getBoundingClientRect) relativa ao espelho — como
// o espelho ocupa o mesmo retângulo de tela que o textarea de verdade, essa posição relativa já
// é a posição certa pra desenhar o balão por cima do textarea real.
export function CorretorBaloes({
  textareaRef,
  texto,
  correcoes,
  onAplicar,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  texto: string
  correcoes: { errado: string; certo: string }[]
  onAplicar: (correcao: { errado: string; certo: string }) => void
}) {
  const mirrorRef = React.useRef<HTMLDivElement>(null)
  const [posicoes, setPosicoes] = React.useState<
    { correcao: { errado: string; certo: string }; top: number; left: number }[]
  >([])

  const medir = React.useCallback(() => {
    const ta = textareaRef.current
    const mirror = mirrorRef.current
    if (!ta || !mirror || correcoes.length === 0) {
      setPosicoes([])
      return
    }
    const cs = window.getComputedStyle(ta)
    const propriedades = [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "letterSpacing",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "boxSizing",
      "textIndent",
    ] as const
    for (const prop of propriedades) {
      mirror.style[prop as any] = cs[prop as any]
    }
    mirror.style.position = "absolute"
    mirror.style.top = "0"
    mirror.style.left = "0"
    mirror.style.width = `${ta.offsetWidth}px`
    mirror.style.height = `${ta.offsetHeight}px`
    mirror.style.whiteSpace = "pre-wrap"
    mirror.style.wordWrap = "break-word"
    mirror.style.overflowWrap = "break-word"
    mirror.style.overflow = "hidden"
    mirror.scrollTop = ta.scrollTop

    // Monta os trechos (texto comum / trecho marcado) na ordem em que aparecem, sem overlap —
    // se duas correções caírem em cima da mesma faixa do texto, a 2ª é ignorada.
    const ocorrencias = correcoes
      .map((c) => ({ c, idx: texto.indexOf(c.errado) }))
      .filter((o) => o.idx !== -1 && o.c.errado.length > 0)
      .sort((a, b) => a.idx - b.idx)

    mirror.innerHTML = ""
    let cursor = 0
    const spans: { el: HTMLSpanElement; correcao: { errado: string; certo: string } }[] = []
    for (const { c, idx } of ocorrencias) {
      if (idx < cursor) continue
      if (idx > cursor) mirror.appendChild(document.createTextNode(texto.slice(cursor, idx)))
      const span = document.createElement("span")
      span.textContent = c.errado
      mirror.appendChild(span)
      spans.push({ el: span, correcao: c })
      cursor = idx + c.errado.length
    }
    if (cursor < texto.length) mirror.appendChild(document.createTextNode(texto.slice(cursor)))

    const mirrorRect = mirror.getBoundingClientRect()
    setPosicoes(
      spans.map(({ el, correcao }) => {
        const r = el.getBoundingClientRect()
        return { correcao, top: r.top - mirrorRect.top, left: r.left - mirrorRect.left }
      }),
    )
  }, [texto, correcoes, textareaRef])

  React.useLayoutEffect(() => {
    medir()
  }, [medir])

  // Textarea com scroll (texto maior que a caixa) muda a posição relativa das linhas — mantém o
  // espelho e os balões sincronizados ao rolar.
  React.useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.addEventListener("scroll", medir)
    return () => ta.removeEventListener("scroll", medir)
  }, [textareaRef, medir])

  if (posicoes.length === 0) return <div ref={mirrorRef} className="invisible pointer-events-none" aria-hidden />

  return (
    <>
      <div ref={mirrorRef} className="invisible pointer-events-none" aria-hidden />
      {posicoes.map((p, i) => (
        <button
          key={i}
          type="button"
          title={`Trocar por "${p.correcao.certo}"`}
          onClick={() => onAplicar(p.correcao)}
          className="absolute z-10 -translate-y-full rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 shadow-sm hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
          style={{ top: p.top, left: p.left }}
        >
          {p.correcao.certo}
        </button>
      ))}
    </>
  )
}

export type Correcao = { errado: string; certo: string }

// Corretor por-trecho (Gemini) — dispara ~900ms depois que a pessoa para de digitar. Correção
// simples é aplicada na hora; o resto vira balão clicável (CorretorBaloes). Compartilhado pelas
// caixas de mensagem do WhatsApp e do chat do site.
export function useCorretor(
  texto: string,
  setTexto: React.Dispatch<React.SetStateAction<string>>,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  const [correcoes, setCorrecoes] = React.useState<Correcao[]>([])
  const [corretorErro, setCorretorErro] = React.useState<string | null>(null)
  const textoRef = React.useRef(texto)
  textoRef.current = texto

  React.useEffect(() => {
    if (!texto.trim()) {
      setCorrecoes([])
      setCorretorErro(null)
      return
    }
    const timer = setTimeout(() => {
      api
        .corrigirTexto(texto)
        .then((r) => {
          setCorretorErro(null)
          if (textoRef.current !== texto) return
          const todas = r.correcoes || []
          const simples = todas.filter(correcaoEhSimples)
          const restantes = todas.filter((c) => !simples.includes(c))
          if (simples.length > 0) {
            const el = textareaRef.current
            const focado = !!el && document.activeElement === el
            let cursor = el?.selectionStart ?? texto.length
            let novo = texto
            for (const c of simples) {
              const idx = novo.indexOf(c.errado)
              if (idx === -1) continue
              novo = novo.slice(0, idx) + c.certo + novo.slice(idx + c.errado.length)
              if (cursor >= idx + c.errado.length) cursor += c.certo.length - c.errado.length
            }
            if (novo !== texto) {
              setTexto(novo)
              if (focado) requestAnimationFrame(() => el?.setSelectionRange(cursor, cursor))
            }
          }
          setCorrecoes(restantes.filter((c) => textoRef.current.includes(c.errado)))
        })
        .catch(() => {
          setCorrecoes([])
          setCorretorErro("corretor indisponível")
        })
    }, 900)
    return () => clearTimeout(timer)
  }, [texto])

  function aplicarCorrecao(correcao: Correcao) {
    setTexto((t) => {
      const idx = t.indexOf(correcao.errado)
      if (idx === -1) return t
      return t.slice(0, idx) + correcao.certo + t.slice(idx + correcao.errado.length)
    })
  }

  return { correcoes, corretorErro, aplicarCorrecao }
}
