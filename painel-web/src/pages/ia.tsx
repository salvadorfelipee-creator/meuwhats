import * as React from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkles, Copy, Check, ExternalLink } from "lucide-react"

// Não é um chat embutido — a conversa acontece no app de verdade do Claude (claude.ai),
// gratuito. Essa tela só existe pra dar a URL do conector MCP (ver mcp.js/server.js) e o
// passo a passo de como plugar ela lá. Decisão tomada com o usuário: assim fica sem custo de
// API — só migraria pra um chat embutido aqui dentro se um dia quiser pagar por isso.
export function IaPage() {
  const [info, setInfo] = React.useState<{ configurado: boolean; url?: string } | null>(null)
  const [copiado, setCopiado] = React.useState(false)

  React.useEffect(() => {
    api.mcpInfo().then(setInfo).catch(() => setInfo({ configurado: false }))
  }, [])

  async function copiar() {
    if (!info?.url) return
    try {
      await navigator.clipboard.writeText(info.url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // clipboard pode falhar (sem permissão/contexto não-seguro) — sem tratamento especial,
      // a pessoa ainda pode selecionar e copiar o texto do campo manualmente.
    }
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="h-14 px-4 flex items-center justify-between border-b shrink-0 sticky top-0 bg-background z-10">
        <div>
          <p className="font-semibold text-sm">IA</p>
          <p className="text-xs text-muted-foreground">Claude conectado ao painel</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Peça pro Claude fazer por você</h2>
            <p className="text-sm text-muted-foreground">
              Agendar campanha de WhatsApp, publicar post na Agenda, criar campanha de anúncio — direto por
              comando, na sua conta grátis do Claude.
            </p>
          </div>
        </div>

        {info === null && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {info && !info.configurado && (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Ainda não configurado neste servidor — falta a variável <code className="text-foreground">MCP_ACCESS_TOKEN</code> no
            Render.
          </div>
        )}

        {info?.configurado && info.url && (
          <>
            <div className="rounded-xl border p-4 flex flex-col gap-3">
              <p className="text-sm font-medium">1. Copie a URL do conector</p>
              <div className="flex gap-2">
                <Input readOnly value={info.url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" size="icon" onClick={copiar} className="shrink-0">
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Essa URL já autentica sozinha — não compartilhe com ninguém fora da equipe.
              </p>
            </div>

            <div className="rounded-xl border p-4 flex flex-col gap-2">
              <p className="text-sm font-medium">2. No Claude, adicione como conector</p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside flex flex-col gap-1">
                <li>Abra o Claude e vá em Configurações → Conectores</li>
                <li>Clique em "+" → "Adicionar conector personalizado"</li>
                <li>Cole a URL copiada acima e confirme</li>
              </ol>
            </div>

            <div className="rounded-xl border p-4 flex flex-col gap-2">
              <p className="text-sm font-medium">3. Peça no chat do Claude</p>
              <p className="text-sm text-muted-foreground">
                Ex: "agende uma campanha de WhatsApp pro template X amanhã às 10h" ou "crie uma campanha de
                anúncio pausada de R$20/dia".
              </p>
            </div>

            <Button asChild className="gap-2 w-fit">
              <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">
                Abrir Claude <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
