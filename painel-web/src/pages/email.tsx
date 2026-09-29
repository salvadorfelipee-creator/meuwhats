import * as React from "react"
import { useChannel } from "@/lib/channel-context"
import { api, type EmailTemplate, type EmailAgendado } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Mail, Plus, Trash2, Send } from "lucide-react"

function formatData(ms: number): string {
  return new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function GerenciarTemplates({
  businessId,
  templates,
  onChange,
}: {
  businessId: string
  templates: EmailTemplate[]
  onChange: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [nome, setNome] = React.useState("")
  const [assunto, setAssunto] = React.useState("")
  const [corpo, setCorpo] = React.useState("")
  const [salvando, setSalvando] = React.useState(false)

  async function criar() {
    if (!nome.trim() || !assunto.trim() || !corpo.trim()) return
    setSalvando(true)
    try {
      await api.criarEmailTemplate(businessId, nome.trim(), assunto.trim(), corpo.trim())
      setNome("")
      setAssunto("")
      setCorpo("")
      onChange()
    } finally {
      setSalvando(false)
    }
  }

  async function apagar(id: number) {
    await api.apagarEmailTemplate(businessId, id)
    onChange()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Templates de e-mail</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
            {templates.length === 0 && <p className="text-sm text-muted-foreground">Nenhum template criado ainda.</p>}
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.assunto}</p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => apagar(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t pt-4">
            <p className="text-sm font-medium">Novo template</p>
            <Input placeholder="Nome (só pra identificar), ex. Aniversário" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input placeholder="Assunto — pode usar {{nome}}" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
            <Textarea
              placeholder="Corpo em HTML — pode usar {{nome}}"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={criar} disabled={salvando || !nome.trim() || !assunto.trim() || !corpo.trim()} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Criar template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AgendarCampanha({
  businessId,
  templates,
  onScheduled,
}: {
  businessId: string
  templates: EmailTemplate[]
  onScheduled: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [templateId, setTemplateId] = React.useState<number | null>(null)
  const [contatosTexto, setContatosTexto] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  // Formato simples, uma linha por contato: email, nome, AAAA-MM-DDTHH:MM
  function parseContatos() {
    return contatosTexto
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((linha) => {
        const [email, nome, dataHora] = linha.split(",").map((s) => s.trim())
        const timestamp = dataHora ? new Date(dataHora).getTime() : NaN
        return { email, nome: nome || undefined, agendadoPara: timestamp }
      })
  }

  async function agendar() {
    if (!templateId) return
    const contatos = parseContatos()
    if (!contatos.length || contatos.some((c) => !c.email || Number.isNaN(c.agendadoPara))) {
      setErro("Cada linha precisa ser: email, nome, AAAA-MM-DDTHH:MM (nome é opcional)")
      return
    }
    setErro(null)
    setEnviando(true)
    try {
      await api.agendarEmailCampanha(businessId, templateId, contatos)
      setContatosTexto("")
      setOpen(false)
      onScheduled()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao agendar")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5" disabled={!templates.length}>
          <Send className="h-3.5 w-3.5" />
          Agendar campanha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agendar campanha de e-mail</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium mb-1.5">Template</p>
            <select
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              value={templateId ?? ""}
              onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Selecione um template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-sm font-medium mb-1.5">Contatos — um por linha</p>
            <Textarea
              placeholder={"email@exemplo.com, Nome, 2026-10-05T09:00\noutro@exemplo.com, , 2026-10-05T09:05"}
              value={contatosTexto}
              onChange={(e) => setContatosTexto(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">Formato: e-mail, nome (opcional), data e hora (horário local)</p>
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button onClick={agendar} disabled={enviando || !templateId}>
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EmailPage() {
  const { current } = useChannel()
  const [templates, setTemplates] = React.useState<EmailTemplate[]>([])
  const [fila, setFila] = React.useState<EmailAgendado[]>([])
  const [loading, setLoading] = React.useState(true)

  const businessId = current?.id || null

  const carregar = React.useCallback(() => {
    if (!businessId) return
    setLoading(true)
    Promise.all([api.emailTemplates(businessId), api.emailFila(businessId)])
      .then(([t, f]) => {
        setTemplates(t)
        setFila(f)
      })
      .finally(() => setLoading(false))
  }, [businessId])

  React.useEffect(() => {
    carregar()
  }, [carregar])

  async function cancelar(id: number) {
    await api.cancelarEmailFila(id)
    carregar()
  }

  if (!businessId) {
    return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Carregando canal...</div>
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="h-14 px-4 flex items-center justify-between border-b shrink-0 sticky top-0 bg-background z-10">
        <div>
          <p className="font-semibold text-sm">Email</p>
          <p className="text-xs text-muted-foreground">{current?.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <GerenciarTemplates businessId={businessId} templates={templates} onChange={carregar} />
          <AgendarCampanha businessId={businessId} templates={templates} onScheduled={carregar} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Fila de envio ({fila.length} pendente{fila.length === 1 ? "" : "s"})</h2>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {!loading && fila.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada agendado agora. Crie um template e agende uma campanha pra começar.</p>
        )}

        <div className="flex flex-col gap-2">
          {fila.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.destinatario_nome || item.destinatario_email}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.destinatario_email} · {item.template_nome} · {formatData(item.agendado_para)}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => cancelar(item.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
