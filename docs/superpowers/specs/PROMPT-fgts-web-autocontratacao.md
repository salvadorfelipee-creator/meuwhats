# Prompt para nova conversa — Autocontratação FGTS no site (felizcred.com.br)

Cole a mensagem abaixo como a primeira mensagem de uma conversa nova com o Claude Code, na raiz do repo `meuwhatsapp`.

---

Quero substituir o simulador de FGTS embutido no site da Felizcred por um formulário próprio, bonito e intuitivo, que faça TODO o processo de autocontratação (simular → mostrar oferta → coletar dados → gerar contrato → assinatura → acompanhar status), sem depender do WhatsApp Flow que construímos antes.

**Onde fica o problema hoje:** em `felizcred-site/index.html`, a seção `#fgts-simular` (por volta da linha 1004-1013) embute um iframe de terceiro (`https://auto.v8sistema.com/...`) como simulador. Quero tirar esse iframe e colocar nosso próprio formulário ali, com nossa própria integração.

**Referência de UX:** o padrão dos grandes bancos que fazem muito volume de FGTS (Pan, Caixa Tem, C6) é: CPF primeiro → valor liberado em destaque visual grande → esteira de etapas com barra de progresso (algo como "1. Simulação 2. Seus dados 3. Documento 4. Endereço 5. Recebimento 6. Assinatura") → confirmação final com link/redirecionamento pra assinatura do contrato. Mobile-first, sem jargão técnico, com selos de confiança (ex: "sem consulta ao SPC", "PIX em minutos"). Use isso como norte de design, não precisa copiar nenhuma tela específica.

**O backend já existe — é só reaproveitar, não recriar:** construímos recentemente (branch `main`, commits `8654167`..`7e91071`) toda a integração com a Unnotech pro fluxo de WhatsApp. Antes de desenhar qualquer coisa, leia:
- `unnotech.js` — cliente puro da API da Unnotech (sem nenhum acoplamento a WhatsApp: `criarSolicitacao`, `consultarStatus`, `consultarSolicitacaoCompleta`, `requotar`, `enviarKyc`, `aceitarOferta`, `consultarProposta`, `cpfValido`, `filtrarOfertaJ17`, `montarPayloadKyc`, `BANCOS_COMPE`, `MAPA_TIPO_CONTA`). Isso é 100% reutilizável como está.
- `db.js` — tabela `fgts_origination` e funções `fgtsOriginationCriar/BuscarAberta/BuscarPorId/Atualizar/ListarAbertas/BuscarPorFlowToken/Reivindicar`. Hoje a chave é `(phone, business_number_id)` porque é WhatsApp — isso vai precisar mudar pro fluxo web (ver "Perguntas abertas" abaixo).
- `server.js` — procure por `iniciarOriginacaoFgts`, `processarEtapaAbrindo`, `processarSubmissaoFormularioFgts`, `processarEtapaAguardandoAssinatura`, `processarEtapaAguardandoPagamento`, `FGTSORIG_*` e o ticker `setInterval` de 30s que persegue o status até `DISBURSED`. Essa máquina de estados inteira é reaproveitável — só a "entrada" (que hoje é um clique de botão do WhatsApp) e a "coleta de dados" (que hoje é um WhatsApp Flow) precisam virar HTTP/web.
- `flows/fgts-cadastro.json` — mesmo que o Flow do WhatsApp deixe de ser usado aqui, esse arquivo já tem o levantamento definitivo dos 24 campos necessários, divididos em 4 blocos: Dados pessoais, Documento, Endereço, Desembolso. Use como contrato de dados.
- `flow-crypto.js` — protocolo de criptografia do WhatsApp Flow. **Não é necessário pro site** (é HTTPS normal), mas o autopreenchimento de CEP que ele fazia via ViaCEP pode ser copiado como uma chamada HTTP simples, direto do backend ou do próprio JS do site.

**Regras de negócio que já foram decididas e têm que continuar valendo:**
- Só oferta do banco J17 (ÔNIX) — ignorar qualquer outro banco na cotação.
- Chave PIX é sempre o CPF do próprio cliente (regra da própria Unnotech) — só perguntar dados de conta bancária se o cliente escolher "Conta bancária" em vez de "PIX" na forma de desembolso.
- Pré-preencher (mas deixar editável): Estado civil = "Solteiro", Escolaridade = "Ensino Médio", Órgão emissor = "SSP".
- Banco escolhido por nome (dropdown), convertido internamente pro código COMPE — nunca pedir o código pro cliente.
- Dígito da agência nunca é perguntado — sempre mandar fixo `"0"`.
- Validar CPF (dígito verificador) antes de abrir qualquer solicitação — já existe `unnotech.cpfValido` pronto.
- `Idempotency-Key` única por operação de escrita na Unnotech (já implementado, só reaproveitar o padrão).
- Oferta expira (hoje 90min) — já tem a lógica pronta em `FGTSORIG_PRAZO_OFERTA_MS`.

**Perguntas que precisam ser respondidas com o usuário ANTES de desenhar (siga a skill de brainstorming, isso é arquitetural):**
1. O cliente que preenche pelo site também deve continuar recebendo avisos por WhatsApp (oferta caiu, contrato pronto, dinheiro pago), reaproveitando as mensagens que já existem em `server.js`? Ou o acompanhamento de status deve ser 100% dentro do próprio site (com uma página de status por link/token)? Isso decide se ainda vale coletar um telefone no formulário.
2. Como identificar a sessão de alguém que está preenchendo o formulário no site (sem número de WhatsApp)? Precisa de um token de sessão (cookie/localStorage + parâmetro na URL) — a tabela `fgts_origination` vai precisar de uma nova forma de chave além de `(phone, business_number_id)`.
3. `felizcred-site/` é um projeto Vercel separado (Root Directory=felizcred-site) e `server.js` roda no Render — ou seja, qualquer endpoint novo pro formulário vai ser uma chamada cross-origin (CORS) do site pro backend. Precisa decidir se os novos endpoints ficam no `server.js` existente (mais simples, reaproveita tudo) ou em algo separado.
4. O WhatsApp Flow (`flows/fgts-cadastro.json`) e o fluxo de coleta via WhatsApp construído antes devem continuar existindo em paralelo (cliente que chama no WhatsApp ainda preenche por lá), ou esse novo formulário do site substitui os dois canais?

**Restrições do projeto (não são negociáveis):**
- Sem framework de testes — a convenção do repo é `node --check` pra sintaxe e testes manuais reais (`node -e`, servidor local + `curl`).
- Nunca commitar segredo nenhum; `README.md` sempre atualizado como fonte de verdade.
- Push direto na `main` (sem branch/worktree separado) — é assim que este projeto sempre trabalhou.
- Atenção: um push na `main` dispara deploy automático TANTO no Render (backend) QUANTO no Vercel do `felizcred-site` (é o mesmo repo, pastas diferentes) — qualquer erro de sintaxe afeta os dois ao mesmo tempo.

Comece explorando os arquivos citados acima, depois use a skill de brainstorming (isso é uma mudança arquitetural — novo canal de entrada, precisa de spec e plano) pra fechar as 4 perguntas abertas comigo antes de desenhar a solução final.
