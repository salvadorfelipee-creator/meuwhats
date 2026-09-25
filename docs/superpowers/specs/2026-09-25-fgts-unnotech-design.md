# Originação automática de FGTS via Unnotech, pelo WhatsApp

**Status:** desenho aprovado em conversa, aguardando revisão do usuário antes do plano de implementação.
**Data:** 25/09/2026

## Objetivo

Hoje, todo pedido de FGTS coletado pelo WhatsApp (menu padrão, DM do Instagram, ou o fluxo de
anúncio construído em 25/09/2026) termina numa mensagem genérica de "aguarde atendimento" — a
simulação e a contratação são feitas manualmente por um humano num portal do banco parceiro.

Este projeto troca isso por uma integração real com a API da **Unnotech** (parceiro
`LEV INTERMEDIACAO DE NEGOCIOS LTDA`, tabela comercial **J17 / ÔNIX**), deixando **100%
automático**: da simulação até o cliente assinar e receber o dinheiro, sem humano no meio —
exceto quando a própria API falha de um jeito que não é uma recusa de negócio (erro técnico).

## Escopo

- **Só FGTS** por enquanto (a Unnotech também tem originação CLT, fica pra depois, mesmo
  desenho pode ser reaproveitado).
- **Só a tabela J17 (ÔNIX)** — se a cotação trouxer oferta de outro banco, ignora.
- Vale pra **qualquer ponto de entrada que já coleta CPF pra FGTS** no WhatsApp: menu padrão
  (opção 5 / palavra-chave "fgts"/"saque" — já corrigida em 25/09 pra funcionar a qualquer
  momento), o funil de DM do Instagram (que já converge pro mesmo passo `fgts_cpf`), e o fluxo
  do anúncio (`FLUXO_FGTS_ANUNCIO`, construído no mesmo dia). Os três convergem pro mesmo lugar
  assim que o CPF é capturado — o resto do caminho é idêntico.

## Arquitetura

Três peças novas, no mesmo espírito do que já existe nesse código:

1. **`unnotech.js`** (novo módulo, mesmo papel que `wa.js`/`r2.js` já têm) — só fala com a API
   da Unnotech. Nada de lógica de WhatsApp aqui.
2. **Tabela `fgts_origination`** (banco, mesmo espírito de `broadcast_agendado`) — uma linha por
   solicitação em andamento.
3. **Verificador novo** (`setInterval`, ~30s) — consulta o status das linhas abertas na
   Unnotech e avança a conversa quando o estado muda de um jeito que importa.

### `unnotech.js` — funções

```
getAccessToken()                 // cache em memória, renova antes de expires_in vencer
criarSolicitacao(cpf, idemKey)   // POST /api/v1/fgts/applications
consultarStatus(applicationId)   // GET  /api/v1/fgts/applications/{id}/status
enviarKyc(applicationId, kyc)    // POST /api/v1/fgts/applications/{id}/kyc  (upsert, sem Idempotency-Key)
aceitarOferta(appId, offerId, idemKey) // POST /api/v1/fgts/applications/{id}/offers/{offer_id}/accept
requotar(applicationId, idemKey) // POST /api/v1/fgts/applications/{id}/requote
consultarProposta(proposalUuid)  // GET  /api/v1/proposals/{proposal_uuid}
```

Base URL: `https://gtw.unnotech.com.br/public`. Toda escrita exige header
`Idempotency-Key` (UUID gerado por nós, guardado na linha da `fgts_origination` — retry da MESMA
operação reusa a mesma chave, uma operação nova gera outra). `X-Api-External-Id` recebe o
`application_id` que já temos, ecoado em erros/logs pra facilitar suporte.

### Tabela `fgts_origination`

| Coluna | Uso |
|---|---|
| `id` | PK |
| `phone`, `business_number_id` | quem é e por qual número |
| `application_id` | chave estável (não muda) |
| `offer_id` | oferta J17 escolhida, quando existir |
| `proposal_uuid` | muda a cada nova tentativa de contratação |
| `etapa` | nosso controle: `abrindo` / `oferta_apresentada` / `formulario` / `aguardando_assinatura` / `aguardando_pagamento` / `concluido` / `sem_oferta` / `erro` |
| `status_unnotech` | último `status` (ApplicationStatus) que a API devolveu |
| `idempotency_key_atual` | reusada em retry da chamada em andamento |
| `created_at`, `updated_at` | |

### Passos da conversa (`fluxo_passo`)

1. `fgtsorig_abrindo` — CPF capturado, `POST /applications` feito, aguardando cotação
2. `fgtsorig_oferta_apresentada` — achou oferta J17, mandou valor/condições, botões
   **QUERO CONTRATAR** / **AGORA NÃO**
3. `fgtsorig_formulario` — cliente aceitou, mandamos o WhatsApp Flow, aguardando ele preencher e
   enviar
4. `fgtsorig_aguardando_assinatura` — KYC enviado + oferta aceita na Unnotech, aguardando
   `signature_link` aparecer e depois o cliente assinar
5. `fgtsorig_aguardando_pagamento` — assinado (`SIGNED`/`ENDORSED`), aguardando `DISBURSED`
6. limpa o `fluxo_passo` — avisou que caiu, fim

## Formulário de dados (WhatsApp Flow)

Confirmado pelo próprio formulário interno da Unnotech (não pela doc pública, que não
especificava obrigatoriedade). Campos, na ordem das telas do Flow:

**Tela 1 — Dados pessoais**
- Nome completo *(obrigatório)*
- Data de nascimento *(obrigatório)*
- Gênero *(obrigatório, dropdown)*
- E-mail *(obrigatório)*
- Celular *(obrigatório, 11 dígitos)*
- Estado civil *(obrigatório, dropdown, **pré-preenchido "Solteiro"**, editável)*
- Escolaridade *(obrigatório, dropdown, **pré-preenchido "Ensino Médio"**, editável)*
- Nome completo da mãe *(obrigatório)*

**Tela 2 — Documento**
- RG número *(obrigatório)*
- RG órgão emissor *(obrigatório, dropdown, **pré-preenchido "SSP"**, editável)*
- RG UF *(obrigatório, dropdown)*

**Tela 3 — Endereço**
- CEP *(obrigatório)* — dispara chamada nossa a um endpoint dinâmico do Flow que consulta a API
  pública **ViaCEP** e preenche **UF, cidade, bairro e logradouro** sozinho
- Número *(obrigatório)*
- Complemento *(opcional)*

**Tela 4 — Forma de desembolso**
- "Como você quer receber o valor?" → **PIX** ou **Conta bancária**
  - **PIX**: nada mais a perguntar — a Unnotech só aceita chave PIX = CPF do próprio tomador,
    então usamos o CPF que o cliente já mandou. `pix_key = cpf`, `pix_type = "CPF"`,
    `disbursement_method = "PIX"`.
  - **Conta bancária**: Banco (dropdown por **nome**, convertido pra código COMPE por uma
    tabela nossa — cliente não decora código de banco), Tipo de conta (corrente/poupança/
    salário), Agência, Número da conta, Dígito da conta. **Dígito da agência não é perguntado —
    vai sempre fixo `"0"`.**

Tabela de conversão banco→COMPE (a construir, lista inicial pelos bancos mais comuns —
conferir/completar durante a implementação): Banco do Brasil 001, Santander 033, Caixa 104,
Bradesco 237, Itaú 341, Nubank 260, Inter 077, C6 Bank 336, PagBank 290, Mercado Pago 323,
PicPay 380, Banco Original 212, Sicoob 756, Sicredi 748, Safra 422, BTG Pactual 208.

**Risco assumido de propósito** (decisão do usuário, não minha): os 3 campos pré-preenchidos
(estado civil, escolaridade, órgão emissor) podem sair errados se o cliente não perceber que dá
pra editar — aceito porque agiliza o preenchimento pra maioria dos casos.

### Nota técnica sobre o Flow

É a primeira vez que esse código usa WhatsApp Flow. Como o CEP precisa de resposta dinâmica
(consulta ao ViaCEP no meio do preenchimento), o Flow precisa ser do tipo **com endpoint**
(não um Flow estático) — exige troca de chave (nós geramos um par RSA, registramos a pública na
Meta) e request/response criptografados nesse endpoint. Isso é bem mais trabalho que um Flow
simples, e é o item de maior risco técnico desse projeto (capacidade nova, sem precedente nesse
código). **Sugestão de fase**: construir primeiro uma versão do Flow SEM autopreenchimento de
CEP (pede rua/bairro/cidade/UF direto), validar o resto do fluxo ponta a ponta (KYC, aceite,
assinatura, pagamento) funcionando, e só depois acrescentar a criptografia do endpoint pra CEP.

## Mensagens por etapa

| Momento | Texto |
|---|---|
| CPF capturado (as 3 entradas) | "Perfeito! Já estou consultando seu FGTS, isso leva só um minutinho ⏳" |
| Oferta J17 encontrada | "Simulação pronta! 🎉 Você tem *R$ {net_amount}* liberado, em {N}x de R$ {parcela}, taxa de {monthly_interest_rate}% ao mês. Quer contratar?" + botões **QUERO CONTRATAR** / **AGORA NÃO** |
| "AGORA NÃO" | "Sem problemas! 😊 Fico à disposição se mudar de ideia." — limpa o passo |
| "QUERO CONTRATAR" | envia o WhatsApp Flow |
| Flow enviado, KYC ok, oferta aceita | "Perfeito, só um instante que já preparo seu contrato..." |
| `signature_link` disponível | texto: "Seu contrato está pronto! ✍️ Assim que você assinar, eu te aviso por aqui." + mensagem separada só com botão **Assinar contrato** (`cta_url` → `signature_link`, vem pronto da Unnotech, não é gerado por nós) |
| `SIGNED`/`ENDORSED` | "Contrato assinado! 🎉 Agora é só aguardar o depósito — te aviso assim que cair na sua conta." |
| `DISBURSED` | "O valor já caiu! 💰 Qualquer coisa, é só me chamar." — fim, limpa o passo |

### Sem oferta / recusa (classificação por palavra-chave no `reason`/`message` da API — os
códigos exatos ainda não são conhecidos, ajustar depois de ver respostas reais)

| Se o texto da recusa mencionar... | Mensagem |
|---|---|
| autorização / não autorizado | "Não encontrei oferta disponível agora — provavelmente falta autorizar a J17 no app Meu FGTS (Autorizações). Autoriza lá e manda 'menu' que eu tento de novo." |
| saldo / sem valor / indisponível | "Pelo que vi, você já usou o saque-aniversário nos últimos 12 meses — a regra só permite 1 vez nesse período. Pode tentar de novo depois desse prazo." |
| não reconhecido | "No momento não encontrei condições disponíveis pro seu FGTS. Se quiser, tenta de novo mais tarde." |

## Tratamento de erro e borda

- **Erro técnico (não é recusa de negócio)** — 5xx, timeout, `401` persistente após 1 retry de
  token, `403 ACCESS_BLOCKED`, `429 QUOTA_EXCEEDED` (limite de 100 aberturas/dia) — encaminha
  pra atendimento humano (`confirmarEncaminhamentoHumano`, já existe) e loga bem detalhado
  (isso é bug/operação nossa, não decisão do cliente).
- **`409 OFFER_EXPIRED` no aceite** (cliente demorou mais de 1h pra preencher o Flow) —
  tenta `requote` automaticamente 1x antes de avisar o cliente; se vier oferta J17 nova, segue
  normal; se não, cai no fluxo de "sem oferta".
- **`422 DISBURSEMENT_DATA_REQUIRED`** — só deveria acontecer se algo no nosso mapeamento do
  Flow pra KYC estiver errado (sempre mandamos os dados de desembolso antes de aceitar) — loga
  como erro nosso e encaminha pra humano, não é algo pra explicar ao cliente.
  Cliente abandona o Flow sem enviar (não bate no nosso endpoint) — reaproveita o mecanismo de
  `lembreteMinutos` já existente: 1 lembrete gentil depois de alguns minutos, perguntando se
  precisa de ajuda pra preencher.
- **`CONTRACT_REJECTED`** (banco recusa depois do aceite) — a doc diz que permite aceitar outra
  oferta, mas como só trabalhamos com J17, na prática não sobra alternativa — trata como recusa
  final, mensagem genérica + oferece encaminhar pra humano (esse caso é diferente das recusas
  de simulação, é uma recusa depois de já ter passado pela KYC, vale um humano olhar).
- **`409 IDEMPOTENCY_KEY_REUSED`** — não deveria acontecer (cada operação gera chave nova) — se
  aparecer, é sinal de bug nosso, loga e investiga.

## Segurança e credenciais

- `UNNOTECH_CLIENT_ID` / `UNNOTECH_CLIENT_SECRET` — variável de ambiente no Render, nunca no
  README nem commitado (mesma regra de sempre desse projeto).
- Chave privada RSA do Flow (pra decriptar as chamadas do endpoint dinâmico) — também variável
  de ambiente, gerada uma vez, a pública registrada na Meta.
- Token de acesso da Unnotech fica em memória (cache), renovado antes do `expires_in` vencer —
  nunca gerado um por requisição, como a doc pede.
- Nenhum log em texto puro além do que esse código já loga hoje pra CPF/telefone (mesmo nível
  de exposição que já existe, não um passo atrás).

## Fases sugeridas de implementação

1. `unnotech.js` + tabela `fgts_origination` + verificador — testável isolado, sem UI nenhuma
   ainda, só confirmando que dá pra abrir solicitação/consultar status com credencial real.
2. Fluxo de simulação (CPF → oferta J17 apresentada) nas 3 entradas, sem ainda contratar nada.
3. WhatsApp Flow **sem** autopreenchimento de CEP (rua/bairro/cidade/UF manuais) + envio de KYC
   + aceite da oferta.
4. Assinatura (link) + acompanhamento até `DISBURSED`.
5. Autopreenchimento de CEP via endpoint dinâmico criptografado (a parte mais nova/arriscada,
   por último, com o resto já provado funcionando).

## Plano de teste

- Com `client_id`/`client_secret` reais: abrir 1 solicitação de teste, confirmar cotação,
  mandar KYC incompleto de propósito pra ver o `422` real (confirma/corrige a lista de
  obrigatórios acima), depois completo, aceitar oferta, confirmar que `signature_link` aparece.
- Testar os 2 motivos de recusa conhecidos (CPF sem autorizar J17; CPF que já sacou este ano),
  se der pra simular algum caso real ou de teste.
- Testar o Flow de verdade num celular (as 4 telas, os 3 campos pré-preenchidos, o
  autopreenchimento de CEP depois de implementado).
- Ponta a ponta com 1 cliente real (com acompanhamento próximo) antes de deixar 100% solto.

## Itens em aberto (validar com chamada real, não travam o início da implementação)

- Códigos exatos de `code`/`reason` que a API usa pras duas recusas conhecidas — hoje
  classificamos por palavra-chave no texto, ajustar assim que vermos respostas reais.
- Lista de bancos→COMPE incompleta, expandir conforme aparecer necessidade.
- Confirmar que TODOS os campos marcados obrigatório no formulário interno da Unnotech são
  realmente exigidos pela API pública (o mais provável, mas só o `422` real confirma).
