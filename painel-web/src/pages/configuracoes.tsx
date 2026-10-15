import * as React from "react"
import { api, PIPELINE_ESTAGIOS, type Usuario } from "@/lib/api"
import { useChannel } from "@/lib/channel-context"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShieldCheck, UserX, UserCheck, KeyRound, Bell, Sparkles } from "lucide-react"

// Configurações — layout em trilha de categorias à esquerda + painel à direita (mesmo padrão
// adotado no fork da Especitá, ver docs/redesign lá). Aqui só as duas categorias que já têm
// backend pronto: "Equipe" (login por pessoa, ver usuarios/me em db.js) e "Integrações" (status
// ao vivo de WhatsApp/R2, ver /painel/api/integracoes/status). "Respostas prontas"/"Backup"/
// "IA & Automação" ficaram de fora de propósito (fora do escopo desta tela por ora).

const CATEGORIAS = [
  { id: "equipe", label: "Equipe", desc: "Usuários e permissões" },
  { id: "integracoes", label: "Integrações", desc: "Canais, status e uso das conexões" },
] as const
type Categoria = (typeof CATEGORIAS)[number]["id"]

export function ConfiguracoesPage() {
  const [categoria, setCategoria] = React.useState<Categoria>("equipe")

  return (
    <div className="h-screen overflow-y-auto flex flex-col">
      <div className="h-14 px-4 flex items-center border-b shrink-0 sticky top-0 bg-background z-10">
        <p className="font-semibold text-sm">Configurações</p>
      </div>

      <div className="flex-1 flex flex-wrap">
        <div className="flex-[1_1_260px] max-w-[260px] shrink-0 border-r px-2.5 py-4">
          {CATEGORIAS.map((c) => {
            const ativo = categoria === c.id
            return (
              <button
                key={c.id}
                onClick={() => setCategoria(c.id)}
                className={`w-full text-left flex flex-col gap-0.5 px-3 py-2.5 rounded-lg mb-0.5 ${
                  ativo ? "bg-[#EAF4F1] dark:bg-emerald-950/30" : "hover:bg-accent"
                }`}
              >
                <span className={`text-[13px] ${ativo ? "font-semibold text-[#0E7C6B] dark:text-emerald-400" : "font-medium"}`}>
                  {c.label}
                </span>
                <span className="text-[11.5px] text-muted-foreground">{c.desc}</span>
              </button>
            )
          })}
        </div>

        <div className="flex-[999_1_560px] min-w-0 px-8 py-8 max-w-3xl">
          {categoria === "equipe" && <AbaEquipe />}
          {categoria === "integracoes" && <AbaIntegracoes />}
        </div>
      </div>
    </div>
  )
}

function AbaEquipe() {
  const { identidade } = useAuth()

  if (identidade?.papel !== "admin") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold mb-1">Equipe</h2>
          <p className="text-xs text-muted-foreground">
            Só administradores podem ver e gerenciar as contas da equipe.
          </p>
        </div>
        <div className="rounded-xl border p-4 flex flex-col gap-1 max-w-sm">
          <p className="text-sm font-medium">{identidade?.nome || "—"}</p>
          <p className="text-xs text-muted-foreground">@{identidade?.usuario} · Atendente</p>
        </div>
      </div>
    )
  }

  return <AbaEquipeAdmin />
}

function AbaEquipeAdmin() {
  const { channels } = useChannel()
  const canaisWhatsapp = channels.filter((c) => c.kind === "whatsapp")

  const [usuarios, setUsuarios] = React.useState<Usuario[]>([])
  const [carregando, setCarregando] = React.useState(true)
  const [erro, setErro] = React.useState<string | null>(null)

  const [nome, setNome] = React.useState("")
  const [usuarioLogin, setUsuarioLogin] = React.useState("")
  const [senha, setSenha] = React.useState("")
  const [papel, setPapel] = React.useState<"admin" | "atendente">("atendente")
  const [canaisSelecionados, setCanaisSelecionados] = React.useState<string[]>([])
  // Etapas do funil de empréstimo (PIPELINE_ESTAGIOS) que disparam notificação urgente/piscando
  // pra essa pessoa (ver conversaEhUrgente em api.ts) — nenhuma marcada = só notificação normal
  // (calma), padrão sensato pra quem acabou de ser criado.
  const [etapasSelecionadas, setEtapasSelecionadas] = React.useState<string[]>([])
  const [criando, setCriando] = React.useState(false)

  const carregar = React.useCallback(() => {
    setCarregando(true)
    api
      .usuarios()
      .then(setUsuarios)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar usuários"))
      .finally(() => setCarregando(false))
  }, [])

  React.useEffect(() => {
    carregar()
  }, [carregar])

  function alternarCanal(id: string) {
    setCanaisSelecionados((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  function alternarEtapaNova(id: string) {
    setEtapasSelecionadas((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]))
  }

  async function criar() {
    if (!nome.trim() || !usuarioLogin.trim() || !senha.trim()) return
    setCriando(true)
    setErro(null)
    try {
      await api.criarUsuario({
        nome: nome.trim(),
        usuario: usuarioLogin.trim(),
        senha,
        papel,
        canais_padrao: papel === "admin" || canaisSelecionados.length === 0 ? null : canaisSelecionados,
        etapas_notificacao: papel === "admin" || etapasSelecionadas.length === 0 ? null : etapasSelecionadas,
      })
      setNome("")
      setUsuarioLogin("")
      setSenha("")
      setPapel("atendente")
      setCanaisSelecionados([])
      setEtapasSelecionadas([])
      carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar usuário")
    } finally {
      setCriando(false)
    }
  }

  async function alternarAtivo(u: Usuario) {
    await api.atualizarUsuario(u.id, { ativo: !u.ativo })
    carregar()
  }

  async function redefinirSenha(u: Usuario) {
    const nova = window.prompt(`Nova senha para ${u.nome}:`)
    if (!nova || !nova.trim()) return
    await api.redefinirSenhaUsuario(u.id, nova.trim())
  }

  async function alternarPapel(u: Usuario) {
    const novoPapel = u.papel === "admin" ? "atendente" : "admin"
    await api.atualizarUsuario(u.id, { papel: novoPapel })
    carregar()
  }

  // Edição inline das etapas de notificação urgente de UM usuário por vez (ver
  // conversaEhUrgente em api.ts) — reaproveita o mesmo padrão de checkbox da criação acima.
  const [editandoNotifId, setEditandoNotifId] = React.useState<number | null>(null)
  const [etapasEditando, setEtapasEditando] = React.useState<string[]>([])
  const [salvandoNotif, setSalvandoNotif] = React.useState(false)

  function abrirEdicaoNotificacoes(u: Usuario) {
    setEditandoNotifId(u.id)
    setEtapasEditando(u.etapas_notificacao || [])
  }

  function alternarEtapaEditando(id: string) {
    setEtapasEditando((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]))
  }

  async function salvarNotificacoes(u: Usuario) {
    setSalvandoNotif(true)
    try {
      await api.atualizarUsuario(u.id, { etapas_notificacao: etapasEditando })
      setEditandoNotifId(null)
      carregar()
    } finally {
      setSalvandoNotif(false)
    }
  }

  function resumoNotificacao(u: Usuario): string {
    if (u.papel === "admin") return "Notificação calma (administrador)"
    if (!u.etapas_notificacao?.length) return "Notificação calma (sem etapa)"
    const nomes = u.etapas_notificacao
      .map((id) => PIPELINE_ESTAGIOS.find((e) => e.id === id)?.nome || id)
      .join(", ")
    return `Pisca em: ${nomes}`
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold mb-1">Equipe</h2>
        <p className="text-xs text-muted-foreground">
          Cada pessoa com login próprio. Administrador vê todos os canais; atendente só vê os canais marcados
          abaixo (Instagram continua visível pra todo mundo).
        </p>
      </div>

      <div className="rounded-xl border p-4 flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-muted-foreground">Nova pessoa</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Nome (ex.: Aline)" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input placeholder="Login (ex.: aline)" value={usuarioLogin} onChange={(e) => setUsuarioLogin(e.target.value)} />
          <Input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="col-span-2"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["atendente", "admin"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPapel(p)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                papel === p ? "bg-[#0F2A26] text-white dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:bg-accent border"
              }`}
            >
              {p === "admin" ? "Administrador" : "Atendente"}
            </button>
          ))}
        </div>
        {papel === "atendente" && canaisWhatsapp.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">
              Canais que essa pessoa vê (nenhum marcado = vê todos)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {canaisWhatsapp.map((c) => (
                <label
                  key={c.id}
                  className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer flex items-center gap-1.5 ${
                    canaisSelecionados.includes(c.id) ? "bg-accent border-accent-foreground/20" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={canaisSelecionados.includes(c.id)}
                    onChange={() => alternarCanal(c.id)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
        )}
        {papel === "atendente" ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">
              Etapas do funil de empréstimo em que essa pessoa recebe notificação urgente, piscando (nenhuma
              marcada = só notificação normal)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PIPELINE_ESTAGIOS.map((e) => (
                <label
                  key={e.id}
                  className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer flex items-center gap-1.5 ${
                    etapasSelecionadas.includes(e.id) ? "bg-accent border-accent-foreground/20" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={etapasSelecionadas.includes(e.id)}
                    onChange={() => alternarEtapaNova(e.id)}
                  />
                  {e.nome}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Administrador recebe só notificação normal (calma), nunca pisca por etapa.
          </p>
        )}
        <Button size="sm" className="w-fit" onClick={criar} disabled={criando || !nome.trim() || !usuarioLogin.trim() || !senha.trim()}>
          Criar acesso
        </Button>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </div>

      <div className="rounded-xl border divide-y">
        {carregando && <p className="px-4 py-6 text-sm text-muted-foreground">Carregando...</p>}
        {!carregando && usuarios.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum usuário cadastrado ainda.</p>
        )}
        {usuarios.map((u) => (
          <div key={u.id} className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  {u.nome}
                  {u.papel === "admin" && <ShieldCheck className="h-3.5 w-3.5 text-[#0E7C6B]" />}
                  {!u.ativo && <span className="text-[10px] font-medium text-destructive">Desativado</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{u.usuario} · {u.papel === "admin" ? "Administrador (todos os canais)" : u.canais_padrao?.length ? u.canais_padrao.join(", ") : "Todos os canais"}
                  {" · "}
                  {resumoNotificacao(u)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  title={
                    u.papel === "admin"
                      ? "Administrador recebe só notificação normal — não dá pra configurar piscar por etapa"
                      : "Configurar notificação urgente por etapa"
                  }
                  disabled={u.papel === "admin"}
                  onClick={() => abrirEdicaoNotificacoes(u)}
                >
                  <Bell className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Redefinir senha" onClick={() => redefinirSenha(u)}>
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" title={u.papel === "admin" ? "Tornar atendente" : "Tornar administrador"} onClick={() => alternarPapel(u)}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" title={u.ativo ? "Desativar" : "Reativar"} onClick={() => alternarAtivo(u)}>
                  {u.ativo ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {editandoNotifId === u.id && (
              <div className="rounded-lg border bg-muted/30 p-2.5 flex flex-col gap-2">
                <label className="text-xs text-muted-foreground">
                  Etapas em que {u.nome} recebe notificação urgente, piscando (nenhuma marcada = só notificação
                  normal)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PIPELINE_ESTAGIOS.map((e) => (
                    <label
                      key={e.id}
                      className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer flex items-center gap-1.5 ${
                        etapasEditando.includes(e.id) ? "bg-accent border-accent-foreground/20" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={etapasEditando.includes(e.id)}
                        onChange={() => alternarEtapaEditando(e.id)}
                      />
                      {e.nome}
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" className="w-fit" disabled={salvandoNotif} onClick={() => salvarNotificacoes(u)}>
                    {salvandoNotif ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button size="sm" variant="ghost" className="w-fit" onClick={() => setEditandoNotifId(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatarBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Tier de limite de mensagem da Meta vem como "TIER_250"/"TIER_1K"/"TIER_10K"/"TIER_100K"/
// "TIER_UNLIMITED" — não é pra mostrar isso cru pro usuário.
const TIER_LABEL: Record<string, string> = {
  TIER_250: "250 conversas/24h",
  TIER_1K: "1.000 conversas/24h",
  TIER_10K: "10.000 conversas/24h",
  TIER_100K: "100.000 conversas/24h",
  TIER_UNLIMITED: "Sem limite",
}

// Integrações — status E uso de verdade, não só "conectado/desconectado". WhatsApp e R2 vêm de
// `GET /painel/api/integracoes/status` (dado real, consultado na hora).
function AbaIntegracoes() {
  const { channels, current } = useChannel()
  const [status, setStatus] = React.useState<Awaited<ReturnType<typeof api.integracoesStatus>> | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  React.useEffect(() => {
    api
      .integracoesStatus()
      .then(setStatus)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao consultar integrações"))
  }, [])

  const r2Pct = status?.r2 ? Math.min(100, Math.round((status.r2.usedBytes / status.r2.limiteBytes) * 100)) : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Integrações</h2>
        <p className="text-xs text-muted-foreground">
          Canais conectados, status e uso de verdade das conexões que o painel depende — pra acompanhar antes de
          bater num limite, não só descobrir quando algo já quebrou.
        </p>
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      {/* Canais (WhatsApp com status ao vivo embutido na linha + Instagram só listado) */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Canais conectados</p>
        <div className="rounded-xl border divide-y">
          {channels.map((c) => {
            const numero = c.kind === "whatsapp" ? status?.whatsapp.find((n) => n.label === c.label) : undefined
            return (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {numero && <span className={`h-[7px] w-[7px] rounded-full shrink-0 ${numero.ok ? "bg-green-500" : "bg-red-500"}`} />}
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {c.label}
                      {current?.id === c.id && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#DDF1E4] text-[#2F7D4F] dark:bg-emerald-950/40 dark:text-emerald-400">
                          ativo agora
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {numero
                        ? numero.ok
                          ? `${numero.display_phone_number || c.kind} · Qualidade: ${numero.quality_rating || "—"}`
                          : `Falha ao consultar: ${numero.erro}`
                        : c.kind}
                    </p>
                  </div>
                </div>
                {numero?.ok && numero.messaging_limit_tier && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {TIER_LABEL[numero.messaging_limit_tier] || numero.messaging_limit_tier}
                  </span>
                )}
              </div>
            )
          })}
          {channels.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum canal configurado.</p>}
        </div>
      </div>

      {/* Cloudflare R2 */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Cloudflare R2 (armazenamento de mídia)</p>
        <div className="rounded-xl border p-4">
          {!status && <p className="text-sm text-muted-foreground">Consultando...</p>}
          {status && !status.r2 && <p className="text-sm text-muted-foreground">Não disponível no momento.</p>}
          {status?.r2 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span>{formatarBytes(status.r2.usedBytes)} usados</span>
                <span className="text-muted-foreground">de {formatarBytes(status.r2.limiteBytes)} (plano grátis)</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${r2Pct !== null && r2Pct > 80 ? "bg-amber-500" : "bg-[#0E7C6B]"}`}
                  style={{ width: `${r2Pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pendências — sem token de consulta de uso guardado no servidor ainda */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Ainda sem acompanhamento automático</p>
        <div className="rounded-xl border divide-y">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-[7px] w-[7px] rounded-full shrink-0 bg-stone-300 dark:bg-stone-600" />
              <div>
                <p className="text-sm font-medium">Turso (banco de dados)</p>
                <p className="text-xs text-muted-foreground">Precisa de um token da API da plataforma Turso (diferente do que já conecta o banco) pra consultar uso.</p>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-[7px] w-[7px] rounded-full shrink-0 bg-stone-300 dark:bg-stone-600" />
              <div>
                <p className="text-sm font-medium">Gemini IA</p>
                <p className="text-xs text-muted-foreground">Google não expõe uma API pública de consulta de cota restante — conferir em aistudio.google.com.</p>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-[7px] w-[7px] rounded-full shrink-0 bg-stone-300 dark:bg-stone-600" />
              <div>
                <p className="text-sm font-medium">Meta Ads</p>
                <p className="text-xs text-muted-foreground">O token de acesso usado pra campanha não fica salvo no servidor — precisa de um token de System User guardado no Render.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Assistente de IA e respostas prontas</p>
          <p className="text-xs text-muted-foreground">Essas áreas continuam em telas próprias — "IA" e os atalhos de resposta no composer de Conversas.</p>
        </div>
      </div>
    </div>
  )
}
