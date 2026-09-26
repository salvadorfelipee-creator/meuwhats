# Originação automática de consignado CLT via Unnotech — design

> Execução autorizada 100% autônoma pelo usuário ("eu já autorizo você a fazer tudo sem
> me pedir... termine tudo 100% sem me pedir autorização"). Por isso este spec registra as
> decisões como **rulings** (decisão + porquê + custo se errado), no lugar do processo normal
> de pergunta-e-aprovação do brainstorming. Fonte da API: `docs.unnotech.com.br` (Visão geral
> da API, Guia: Originação CLT, e as páginas de cada endpoint/schema), lidas em 26/09/2026.

## Contexto

Hoje o menu principal do WhatsApp (opção "1"/"clt"/"consignado") pergunta "3 meses ou mais"
vs "menos de 3 meses" de carteira assinada. Quem tem 3+ meses (`clt_3mais`) cai em
`handlerCapturaDadosClt`, que só confirma o recebimento de texto livre e entrega pro
atendimento humano (Felipe). Isso vira 100% automático até a assinatura do contrato, do
mesmo jeito que a originação de FGTS (commits `8654167`..`7e91071`) — reaproveitando
`unnotech.js`/`db.js`/o ticker de 30s de `server.js`, mas com um fluxo mais longo porque o
CLT tem 3 portões que o FGTS não tem: autorização do trabalhador, consulta de margem por
vínculo, e escolha entre "parcela" ou "valor líquido" antes de simular.

## Por que fica em standby

A Unnotech ainda está bloqueada pela mesma pendência de permissão (perfil MARTER-CORBAN) que
já bloqueia o FGTS — `UNNOTECH_CLIENT_ID`/`UNNOTECH_CLIENT_SECRET` continuam sem valor real.
**Ruling:** em vez de depender só da chamada falhando silenciosamente (o que já aconteceria
de qualquer jeito sem credencial válida), adiciono uma trava explícita e única —
`CLT_ORIGINATION_ATIVO` no topo de `server.js`, hoje `false` — que decide se `clt_3mais`
aciona a automação nova ou continua caindo no comportamento manual de hoje
(`handlerCapturaDadosClt`). Ativar exige mudar essa uma linha pra `true` (documentado no
README) depois de confirmar que as credenciais são válidas. **Custo se errado:** nenhum — é
reversível trocando a mesma linha de volta, e o código automático inteiro já fica testado e
comitado esperando a chave.

## Máquina de estados (tabela `clt_origination`)

| Etapa | O que significa | Quem processa |
|---|---|---|
| `aguardando_autorizacao` | Aberto, esperando o trabalhador assinar o termo (`consent_url`) | ticker (poll `/status`) |
| `consultando_margem` | Autorizado, esperando `GET /margin` sair de `MARGIN_QUERY` | ticker |
| `escolhendo_vinculo` | 2+ vínculos — esperando o cliente escolher qual | handler de botão/lista |
| `escolhendo_valor` | Esperando o cliente escolher parcela x valor líquido | handler de botão |
| `aguardando_valor` | Esperando o número em texto livre | capturaTexto |
| `simulando` | `POST /simulations` feito, esperando `quotes_pending = 0` | ticker |
| `oferta_apresentada` | Menu de ofertas mandado, esperando ACEITAR/AGORA NÃO | handler de botão |
| `formulario` | WhatsApp Flow de KYC mandado, esperando `nfm_reply` | webhook |
| `enviando_kyc` | Processando a submissão (KYC + aceite) | processarSubmissao |
| `aguardando_assinatura` | Aceite feito, esperando `SIGNED`/link de assinatura | ticker |
| `aguardando_pagamento` | Assinado/averbado, esperando `DISBURSED` | ticker |
| `concluido` / `sem_oferta` / `erro` | Terminais | — |

**Ruling — vínculo único não pergunta nada:** se `GET /margin` devolver só 1 `employment`,
pulo `escolhendo_vinculo` direto pra `escolhendo_valor` (é o caso comum e poupa uma
pergunta). **Custo se errado:** nenhum caso realista — quem tem 1 emprego só tem 1 vínculo
pra escolher de qualquer jeito.

**Ruling — oferta default é a "melhor" da lista, sem restringir por banco:** diferente do
FGTS (regra explícita do usuário: só J17), a doc confirma que `offers[]` já vem ordenada por
`net_amount` decrescente / `installment_amount` crescente — ou seja, a primeira posição já é
a melhor condição disponível, vinda de qualquer bancarizadora elegível (Celcoin e outras). O
usuário não pediu restrição de banco pro CLT (só disse "o fluxo é diferente do FGTS"), então
apresento a primeira oferta da lista, sem filtro de `source`. **Custo se errado:** se algum
dia o usuário quiser restringir a um banco específico do CLT como fez no FGTS, é uma troca de
uma função (`escolherMelhorOferta`), sem afetar o resto do fluxo.

**Ruling — recusa do banco tenta a próxima oferta do mesmo menu automaticamente:** a doc é
explícita — `CONTRACT_REJECTED` não é terminal, "aceitando outra oferta do mesmo menu, a
solicitação retorna a `CONTRACTING`". Guardo o array `offers[]` da rodada em
`offers_cache` (coluna JSON) e os `offer_id` já tentados em `tentativas_offer_ids`; ao ver
`CONTRACT_REJECTED`, escolho a próxima oferta elegível (status `AVAILABLE`, não expirada,
não tentada) e aceito de novo sem pedir nada ao cliente (o KYC já está na Unnotech). Se
esgotar o menu, cai em `sem_oferta` + encaminhamento humano. **Custo se errado:** no pior
caso o cliente é encaminhado pro humano um pouco antes do necessário (mesma rede de segurança
que o FGTS já tem via `confirmarEncaminhamentoHumano`).

**Ruling — base da simulação, pergunta simples:** ofereço só 2 botões ("Valor da parcela" /
"Valor que eu quero receber") em vez de tentar adivinhar. Se o cliente pedir
`INSTALLMENT` acima da margem disponível (`422 INSTALLMENT_EXCEEDS_MARGIN`), respondo com o
valor máximo de parcela (`available_margin` do vínculo escolhido) e peço um número menor —
fica no mesmo passo (`aguardando_valor`), sem contar como erro. **Custo se errado:** só uma
mensagem extra pro cliente digitar de novo.

**Ruling — KYC usa os mesmos valores estáticos pré-preenchidos do FGTS** (Estado civil =
Solteiro, Escolaridade = Ensino Médio, Órgão emissor = SSP, todos editáveis) — é a mesma regra
de negócio já decidida pelo usuário pro FGTS, não específica de produto. O bloco `employer`
(email/telefone do RH) é opcional na doc — deixo como pergunta final do formulário, sem
bloquear o envio se vier vazio. **Custo se errado:** idêntico ao já aceito no FGTS.

**Ruling — sem pré-preenchimento dinâmico via `GET /kyc`:** a doc mostra que a Unnotech já
devolve um rascunho de KYC parcialmente preenchido pela Dataprev/plataforma. Buscar e
mesclar isso no WhatsApp Flow exigiria o protocolo dinâmico de `data_exchange` (mesma
complexidade que já deixamos de fora do CEP no FGTS). Fica de fora por ora — o cliente
preenche tudo do zero no Flow estático, igual ao FGTS. **Custo se errado:** formulário um
pouco mais longo que o ideal; não é um bug, é escopo deixado de fora de propósito.

**Ruling — `bank_account` no aceite da oferta fica de fora:** a doc confirma que esse bloco
só é necessário "quando a conta de crédito ainda não foi informada — os dados de desembolso
que valem são os do KYC". Como o KYC já manda o bloco `bank` completo, o aceite vai sem
corpo, exatamente como já fazemos no FGTS. **Custo se errado:** nenhum — é o comportamento
documentado.

## Reaproveitamento de `unnotech.js`

`cpfValido`, `BANCOS_COMPE`, `MAPA_TIPO_CONTA`, `normalizarDataFlow`, o helper de
autenticação (`chamarAutenticado`/cache de token) e o padrão de erro com `.codigo` são
genéricos e usados como estão. Funções novas, todas no mesmo arquivo (é cliente puro de API,
sem lógica de WhatsApp, mesmo padrão de sempre): `criarSolicitacaoClt`, `consultarStatusClt`,
`consultarSolicitacaoCompletaClt`, `consultarMargemClt`, `simularClt`, `enviarKycClt`,
`aceitarOfertaClt`, `montarPayloadKycClt`, `escolherMelhorOferta`.

## Itens em aberto (ficam para quando a chave chegar)

- Confirmar contra uma chamada real se `offers[]` de fato sempre vem ordenada como a doc
  promete (a doc é a única fonte disponível sem credencial válida).
- `POST /applications/{id}/authorization` tem rate limit por CPF com `429`/`Retry-After` —
  hoje só relançamos o erro pro handler genérico; se aparecer com frequência na prática, vale
  um backoff dedicado.
- `criarSolicitacaoClt` manda `phone` normalizado (13 dígitos, `55DDN9XXXXXXXX`), mas o KYC
  manda `dados.celular` como o cliente digitou no Flow (normalmente 11 dígitos, sem "55"). Não
  há confirmação de qual formato a Unnotech espera em cada campo — ajustar assim que houver
  chamada real pra observar.
- `montarPayloadKycClt` (unnotech.js) duplica `montarPayloadKyc` linha a linha, só o bloco
  `employer` muda. Não refatorado pra composição (`{...montarPayloadKyc(cpf, dados), employer}`)
  de propósito — o ganho de DRY não paga o risco de alterar uma função do FGTS já testada e em
  produção só por uma function CLT que ainda está em standby.

## Revisão final (fresh reviewer, opus) — 26/09/2026

Revisão da branch despachada num contexto novo encontrou 4 Críticos e 11 Importantes — todos
corrigidos nesta mesma passada, cada um verificado com um teste real (unitário quando fazia
sentido, ponta a ponta via webhook local com Unnotech/WhatsApp mockados quando o bug era de
sequência de estados). Resumo dos consertos mais relevantes — o código já reflete tudo isso:

- **Análise de valor em texto livre** (`extrairValorReais`) não reconhecia "3.000" como 3 mil
  (lia o ponto como decimal, virava 3) — corrigido pra tratar ponto seguido de 3 dígitos como
  separador de milhar, e reconhecer "2 mil"/"3 mil reais".
- **Autorização do trabalhador nunca expirava** e ignorava status terminais (EXPIRED/
  CANCELLED/FAILED) — agora tem prazo próprio de 72h (bem mais longo que o resto, é ação do
  cliente fora do nosso controle) e trata os terminais.
- **Retentativa após `CONTRACT_REJECTED`** tinha 3 problemas: usava o menu da FOTO antiga em
  vez de rebuscar ao vivo (a análise de crédito já tinha mudado o menu real até a recusa
  chegar); não zerava `proposal_uuid`/`link_assinatura_enviado_em`, deixando o cliente com o
  link do contrato JÁ RECUSADO; e não tinha trava contra 2 ticks tratando a mesma recusa em
  paralelo. Corrigido com reivindicação atômica (`retentando_oferta`) + rebusca ao vivo + reset
  dos campos + aviso ao cliente sobre os novos termos (antes trocava a oferta em silêncio).
- **Consulta de margem e status geral da solicitação** só reagiam ao valor EXATO esperado
  ("MARGIN_QUERY"), então qualquer status intermediário não previsto ficava sem o relógio de
  prazo — trocado por uma lista de status "prontos"/"terminais" explícita, resto cai no prazo.
- **Ordem banco-antes-de-avisar** (a mesma lição já paga na revisão do FGTS) não tinha sido
  aplicada em 3 lugares do bloco CLT nem no ponto equivalente do próprio FGTS — corrigido nos 2
  produtos.
- Corrigidas também: chave de idempotência reaproveitada indevidamente numa resimulação;
  reivindicação atômica faltando nos passos de e-mail e de valor (mensagem duplicada podia abrir
  2 solicitações ou 2 simulações); `consent_url` ausente virando "undefined" na mensagem e nunca
  sendo salvo; reentrada de CPF respondendo a mesma frase genérica pra qualquer etapa (inclusive
  as que esperam uma ação específica do cliente) e sem corrigir o `fluxo_passo`; comparação de
  `employment_id` sem `String()` (travava em silêncio se a API devolvesse número); lista de
  vínculos sem ordenar por margem antes de cortar em 10; código morto (`forcarVerificacaoConsentimentoClt`,
  nunca usado); `.codigo` não propagado no erro de `criarSolicitacaoClt`.

**Ruling — problema de janela de 24h do WhatsApp fica de fora do código, é o mesmo limite já
aceito no FGTS.** O revisor apontou que qualquer notificação automática que precise ser mandada
mais de 24h depois da última mensagem do cliente (assinatura que demora dias, pagamento que
demora dias, até a própria autorização) falha silenciosamente sem um template aprovado pela
Meta pra reabrir a conversa fora da janela. Isso é um limite estrutural do WhatsApp, não um bug
deste código — a mesma limitação já existe (e já foi aceita, ver Important #9 do FGTS) pros
estados de assinatura/pagamento do FGTS, que também podem levar dias. **Custo se errado:** um
cliente pode não ser avisado automaticamente numa etapa que demorou muito — mas nada quebra
silenciosamente por muito tempo, porque cada etapa afetada agora tem um teto de tempo (72h pra
autorização, 5 dias pra assinatura/pagamento) que escala pro atendimento humano.

## Redesenho da apresentação de valores — 27/09/2026 (pedido direto do usuário)

O usuário revisou a simulação visual do fluxo (WhatsApp mockup) e pediu uma mudança na forma
como o valor é apresentado, substituindo a pergunta inicial "parcela ou valor líquido":

- **Não pergunta mais nada antes de simular.** Assim que o vínculo é conhecido (1 só, ou
  escolhido numa lista), simula automaticamente com `basis: "INSTALLMENT"` no valor MÁXIMO
  (a margem inteira) — o cliente já vê de cara o que cabe no salário dele.
- **A API já devolve várias ofertas por prazo diferente pra uma parcela fixa** ("a plataforma
  oferta uma condição por prazo viável em cada tabela elegível", conforme o guia da Unnotech) —
  aproveitado pra montar um "cardápio" de prazos (12x/24x/36x, ou quantos vierem), sem precisar
  de simulações extras.
- 3 mensagens em sequência quando há mais de 1 prazo: (1) lista informativa "Tenho aprovado pra
  você: ..." com o valor liberado por prazo; (2) explicação fixa de desembolso (PIX em até 40min,
  primeiro desconto só depois de 60 dias); (3) pergunta com 2 botões — "ESCOLHER UMA OPÇÃO"
  (mostra os prazos numa lista do WhatsApp pra escolher) ou "PARCELA MAIS BAIXA" (pede um valor de
  parcela menor e simula de novo, reentrando no mesmo fluxo). Se só vier 1 prazo, pula direto pra
  confirmação (não faz sentido apresentar cardápio de 1 item só).
- Escolher um prazo (ou já cair direto quando só tem 1) leva ao MESMO passo de confirmação que já
  existia ("Simulação pronta!... Quer contratar?"), sem duplicar nada do restante do fluxo
  (formulário, assinatura, pagamento continuam exatamente iguais).

**Ruling — o valor de cada linha do cardápio é o `net_amount` (valor liberado), não a
parcela.** A doc não documenta literalmente esse formato de apresentação (é uma composição
nossa sobre os dados que a API já devolve), mas como a parcela pedida é fixa (a margem máxima)
em todas as ofertas do cardápio, a variável que muda de prazo pra prazo é o valor liberado —
faz sentido mostrar exatamente essa diferença ("mais prazo = mais dinheiro, mesma parcela").
**Custo se errado:** troca de rótulo (net_amount por installment_amount) é uma linha, sem
impacto em nenhum outro lugar do código.

**Ruling — dedupe por prazo mantém só a melhor oferta de cada `installment_count`, descartando
qualquer outra do mesmo prazo.** `offers[]` já vem ordenada pela Unnotech (net_amount desc), então
pegar a primeira ocorrência de cada prazo distinto já é pegar a melhor por definição, sem
precisar comparar de novo. **Custo se errado:** nenhum, é a mesma garantia que `escolherMelhorOferta`
já usa em outros lugares do código.

**Ruling — chamar `capturarContatoEBoasVindas` (contato no Google + e-mail de boas-vindas) no
fluxo automático fica de fora, precisa de decisão do usuário.** O fluxo manual
(`confirmarDadosRecebidos`) já dispara isso ao reconhecer um e-mail em texto livre; o fluxo
automático também captura e-mail (na etapa `aguardando_email`), mas nome só chega bem depois, no
Flow. Não decidi sozinho SE isso deve rodar automaticamente aqui nem QUANDO (no e-mail, sem
nome; ou na submissão do Flow, com os 2). **Custo se errado:** enquanto ficar em standby,
nenhum. Quando for ativado, contatos que vierem por esse caminho não geram contato no Google
nem recebem o e-mail de boas-vindas que o caminho manual já gera — uma regressão silenciosa de
negócio, não técnica, se ninguém decidir isso antes de ativar.
