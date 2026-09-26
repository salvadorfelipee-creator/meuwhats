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
