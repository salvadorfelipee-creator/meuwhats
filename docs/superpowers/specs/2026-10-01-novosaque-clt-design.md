# Originação automática de consignado CLT via Novo Saque — design

> Execução 100% autônoma, mesmo padrão já usado pro FGTS/CLT da Unnotech nesta sessão
> ("você mesmo faz tudo", "termine tudo 100% sem me pedir"). Decisões registradas como
> **rulings** (decisão + porquê + custo se errado).

## Contexto

A credencial da Unnotech continua travada (permissão MARTER-CORBAN pendente — ver
`docs/superpowers/specs/2026-09-26-clt-unnotech-design.md`). O usuário conseguiu, em paralelo,
acesso de sandbox a um 2º banco — **Novo Saque** (`developers.novosaque.com.br`) — com e-mail de
boas-vindas trazendo a API Key de sandbox já pronta. Pedido explícito: construir o mesmo tipo de
atendimento automático, só trocando o banco por baixo, **sem apagar nada do que já foi feito**
(a Unnotech continua intacta, em standby, esperando a credencial dela).

## Diferente da Unnotech em pontos reais, não só de nome

Tudo abaixo foi **confirmado testando ao vivo contra o sandbox real** (`api.novosaque.dev.br`),
não só lendo a doc — a doc tem pelo menos 2 divergências reais da API (anotadas abaixo).

- **Autenticação muito mais simples**: um único header `X-Api-Key`, sem troca de token OAuth2 e
  sem `Idempotency-Key` documentado. `novosaque.js` reflete isso — bem menor que `unnotech.js`.
- **Só o CPF abre a simulação** — não precisa de e-mail antes (diferente do CLT da Unnotech).
- **Sem portão de "escolher vínculo" nem "escolher base de simulação"** — a 1ª simulação (sem
  nenhum parâmetro de valor) já sai pronta sozinha, com uma condição default, confirmado ao
  vivo (margem de R$1.520 devolveu uma oferta de R$1.170 de parcela — não é "o máximo", é um
  default que o motor de crédito deles escolhe).
- **O consentimento é um formulário hospedado pela PRÓPRIA Novo Saque** (`terms_link`), que já
  coleta nome/e-mail/telefone/CEP/estado/cidade do cliente ali mesmo — diferente da Unnotech
  (só autoriza, não coleta dado nenhum nesse passo).
- **`employer_email`/`employer_phone` são OBRIGATÓRIOS** na formalização — a doc deles diz "não
  especificado", a API real devolve `400 invalid_fields` sem os dois. Corrigido no Flow (campos
  `required: true`, diferente dos opcionais na Unnotech).
- **`pix_key_type` aceita 4 valores** (`cpf`, `email`, `phone_number`, `aleatory_key`) — **não
  tem a mesma restrição da Unnotech** ("PIX só aceita chave = CPF do próprio tomador"). O Flow
  deixa o cliente escolher o tipo de chave (sugerindo CPF como padrão pré-preenchido, editável).
- **Achado de API real divergente da doc**: o campo que `GET/PUT .../simulation` devolve com o
  id da transação se chama `contract`, não `transaction_id` como a doc descreve.
  `novosaque.js` aceita os dois nomes (`body.contract || body.transaction_id`) por segurança.

## Ruling — apresentação de oferta sem "cardápio de prazos"

No CLT da Unnotech, uma simulação com parcela fixa pode devolver várias ofertas em PRAZOS
diferentes (12x/24x/36x), e por isso criamos a tela "escolher uma opção". Testando a Novo Saque
ao vivo, `simulation_results` devolveu **só 1 tabela** (a própria "Novo Saque") — a doc genérica
mostra até 9 tabelas de exemplo, mas isso parece ser cenário de múltiplos bancos parceiros na
mesma cotação, não o caso de produção deste parceiro específico. `escolherMelhorOferta` já lida
com N ofertas (pega a de maior `disbursed_amount`) caso isso mude um dia, mas a tela de
"escolher uma opção" **não foi construída** — direto aceita a melhor automaticamente. **Custo se
errado:** se no futuro vierem várias tabelas de verdade, o cliente só vê a melhor, nunca as
outras — perda de uma opção melhor pro cliente escolher, não um bug de segurança. Fácil de
adicionar depois (mesmo padrão já pronto no CLT/Unnotech) se isso acontecer.

## Ruling — entrada pelo botão "Simulação" do fluxo arquivado, SEM reativar o fluxo

Pedido do usuário: "o telefone que vamos usar vai ser o Campanha CLT, o mesmo que já tem o
fluxo da Uno quase pronto". **Isso não bate com o código real** — o fluxo de pitch de CLT
(`FLUXO_CAMPANHA_CLT`, com o botão "Simulação" → `campclt_simular`) está **arquivado** desde
15/09/2026; o número Campanha CLT hoje roda a campanha ativa de **Indicação FGTS → horas
extras** (`FLUXOS_POR_NUMERO`/`escolherVarianteCampanhaCLT`), um produto totalmente diferente
(diferenças trabalhistas, não consignado) que termina em handoff pra OUTRO número
(+55 47 99978-2256). A automação Unnotech/CLT que já existe vive no número PRINCIPAL
(`FLUXO_FELIZCRED`), não no Campanha CLT.

Dado esse desalinhamento, a automação da Novo Saque foi conectada no ponto já desenhado pra
isso dentro do fluxo arquivado (`handlerCampanhaCLTSimular`), gated pela própria flag de
standby — mas **a reativação do `FLUXO_CAMPANHA_CLT` em si (trocar o destino do tráfego pago ao
vivo de volta pro pitch de CLT) não foi feita**, de propósito. São 2 decisões separadas: ligar
a automação é reversível e sem custo nenhum enquanto a campanha ativa continuar sendo a de
Indicação FGTS; trocar qual campanha roda nesse número é uma decisão de marketing/tráfego pago
que não cabe a mim tomar sozinho. **Custo se errado:** nenhum enquanto ambas as flags
continuarem como estão — quando o usuário decidir usar a Novo Saque de verdade, vai precisar de
2 ações, não 1 (ligar `NOVOSAQUE_ORIGINATION_ATIVO` E reatribuir
`FLUXOS_POR_NUMERO`/a checagem especial de `CAMPANHA_CLT_NUMBER_ID` em `getFluxo`).

## Testado ponta a ponta contra o sandbox real (não só mockado)

Diferente da Unnotech (nunca testada contra API de verdade nesta sessão, só mockada), a Novo
Saque forneceu uma API Key de sandbox real e funcional. Rodei o fluxo completo contra
`api.novosaque.dev.br`, incluindo preencher de verdade o formulário de autorização hospedado
por eles (via navegador), com 2 CPFs de teste diferentes:
- CPF 1 (manual, direto na API): abertura → autorização → margem (R$1.520) → simulação →
  formalização → **erro real de validação** (`ccb_creation_result`: "insurance_amount - must be
  less than 1500") — usado pra confirmar como o código reage a uma falha de verdade.
- CPF 2 (ponta a ponta pelo WhatsApp simulado, servidor local real): clique no botão →
  CPF → autorização automática → margem → oferta apresentada → QUERO CONTRATAR → Flow →
  formalização aceita (202) → **mesmo erro de validação do sandbox** → escalação correta pro
  atendimento humano, com a mensagem certa mandada ao cliente.

**Ruling — `falhaNovoSaque()` varre uma lista fixa de sub-objetos `*_result` procurando
`success: false`.** Esse erro real (`ccb_creation_result`) não aparece em `stage`/
`summary_status` nenhum — só dentro do sub-objeto. Sem essa varredura genérica, a linha ficaria
sendo consultada pra sempre num erro real sem nunca avisar o cliente nem escalar. A lista de
campos varridos foi montada a partir do schema completo que a doc mostra (não só do que
apareceu no teste) — **custo se errado:** um tipo de falha num sub-objeto fora dessa lista (se
a Novo Saque adicionar um novo no futuro) não seria pego automaticamente; o teto de tempo de
cada etapa (`NSORIG_PRAZO_*`) continua como rede de segurança final pra esse caso.

## Reaproveitado sem mudança nenhuma

`extrairValorReais` (parser de valor em texto livre), o padrão de reivindicação atômica
(`novosaqueOriginationReivindicar`), `etapa_em` por transição de etapa, a ordem
"banco-antes-de-avisar" em toda mensagem pós-ação importante, e o cuidado de mandar o Flow
ANTES de gravar a etapa — todos os achados da revisão final do CLT/Unnotech foram aplicados
aqui desde a primeira versão, não como correção depois.

## Achado incidental: bug pré-existente corrigido

Testando contra um banco local totalmente novo (nunca migrado antes), a inicialização travava
com `SQLITE_ERROR: duplicate column name: email` — um `ALTER TABLE conversations ADD COLUMN
email` duplicado em `db.js` (2 blocos independentes, adicionados em datas diferentes, cada um
achando que era o único). Nunca deu problema no banco do Render porque ele já tinha passado por
essa migração há muito tempo (o bug só aparece na 1ª migração de um banco do zero). Corrigido —
não é código novo da Novo Saque, é pré-existente, mas bloqueava qualquer teste local com banco
limpo (inclusive o do Unnotech CLT) se alguém tentasse de novo no futuro.

## Itens em aberto (ficam para quando for pra produção)

- `stage`/`summary_status` no nível raiz do contrato ficaram ~1s atrasados em relação ao último
  item de `status_list`/`summary_status_list` em 2 momentos do teste ao vivo — sem efeito
  prático aqui (o verificador consulta a cada 30s, folga enorme), mas é bom saber que existe
  essa pequena janela de inconsistência eventual do lado deles.
- Reprocessamento de pagamento (`PUT .../reprocess/payment`, pra quando o PIX/conta cadastrada
  está errada) **não foi implementado** — mesmo escopo deixado de fora que o CLT/Unnotech já
  tinha (não é o caminho feliz, cai no mesmo encaminhamento humano genérico).
- Ambiente de produção: a doc diz que a URL só é informada depois da habilitação — hoje
  `novosaque.js` usa `NOVOSAQUE_BASE_HOST` (env var, default sandbox) e `NOVOSAQUE_API_KEY`;
  trocar pra produção é só configurar essas 2 variáveis, sem mudar código.
