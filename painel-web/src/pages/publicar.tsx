import * as React from "react"
import { api, type ContaPublicar, type PublicarResultado, type Rede } from "@/lib/api"
import { fileToBase64 } from "@/lib/file-to-base64"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Send } from "lucide-react"

const REDES_INFO: Record<Rede, string> = {
  instagram: "Instagram",
  instagram_story: "Instagram Stories",
  facebook: "Facebook",
  twitter: "X/Twitter",
  linkedin: "LinkedIn",
  threads: "Threads",
}

export function PublicarPage() {
  const [contas, setContas] = React.useState<ContaPublicar[]>([])
  const [contaId, setContaId] = React.useState("")
  const [texto, setTexto] = React.useState("")
  const [link, setLink] = React.useState("")
  const [redes, setRedes] = React.useState<Rede[]>([])
  const [imagens, setImagens] = React.useState<string[]>([])
  const [enviando, setEnviando] = React.useState(false)
  const [resultado, setResultado] = React.useState<PublicarResultado | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  React.useEffect(() => {
    api.contasPublicar().then((lista) => {
      setContas(lista)
      if (lista.length) setContaId(lista[0].id)
    })
  }, [])

  const conta = contas.find((c) => c.id === contaId)

  function toggleRede(r: Rede) {
    setRedes((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  async function handleImagens(files: FileList | null) {
    if (!files || !files.length) return
    const base64s = await Promise.all(Array.from(files).map(fileToBase64))
    setImagens(base64s)
  }

  async function publicar() {
    setErro(null)
    setResultado(null)
    if (!redes.length) {
      setErro("Marque ao menos uma rede.")
      return
    }
    if (!texto && !imagens.length) {
      setErro("Informe um texto ou uma imagem.")
      return
    }
    setEnviando(true)
    try {
      const { resultados } = await api.publicarAgora({
        contaId,
        texto: texto || undefined,
        link: link || undefined,
        redes,
        imagemBase64: imagens.length === 1 ? imagens[0] : undefined,
        imagensBase64: imagens.length > 1 ? imagens : undefined,
      })
      setResultado(resultados)
      const todasOk = Object.values(resultados).every((r) => r.ok)
      if (todasOk) {
        setTexto("")
        setLink("")
        setImagens([])
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao publicar")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="h-14 px-4 flex items-center border-b shrink-0">
        <p className="font-semibold text-sm">Publicar</p>
      </div>

      <div className="p-4 max-w-xl flex flex-col gap-4">
        {contas.length > 1 && (
          <div>
            <label className="text-sm font-medium mb-1 block">Conta</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={contaId}
              onChange={(e) => {
                setContaId(e.target.value)
                setRedes([])
              }}
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-1 block">Redes</label>
          <div className="flex flex-wrap gap-2">
            {(conta?.redesDisponiveis || []).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleRede(r)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  redes.includes(r) ? "bg-primary text-primary-foreground border-primary" : "border-input"
                }`}
              >
                {REDES_INFO[r]}
              </button>
            ))}
            {conta && !conta.redesDisponiveis.length && (
              <p className="text-xs text-muted-foreground">Nenhuma rede configurada pra essa conta.</p>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Texto</label>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} placeholder="Escreva o post..." />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Link (opcional)</label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Imagem (ou várias, vira carrossel)</label>
          <input type="file" accept="image/*" multiple onChange={(e) => handleImagens(e.target.files)} />
          {imagens.length > 0 && (
            <div className="flex gap-2 mt-2">
              {imagens.map((src, i) => (
                <img key={i} src={src} alt="" className="h-16 w-16 rounded object-cover" />
              ))}
            </div>
          )}
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        {resultado && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(resultado).map(([rede, r]) => (
              <Badge key={rede} variant={r.ok ? "success" : "destructive"}>
                {REDES_INFO[rede as Rede] || rede}: {r.ok ? "publicado" : r.erro || "erro"}
              </Badge>
            ))}
          </div>
        )}

        <Button onClick={publicar} disabled={enviando} className="self-start">
          <Send className="h-4 w-4 mr-1" /> {enviando ? "Publicando..." : "Publicar agora"}
        </Button>
      </div>
    </div>
  )
}
