# Funil de recuperação e reativação — FelizCred

## 1. Roteamento dos dois números

Nos números Principal e Campanha CLT:

- mensagem contendo `CLT`, `consignado`, `crédito do trabalhador` ou `carteira assinada` → botão para o chat seguro do site;
- `consignado INSS` não entra no fluxo CLT;
- mensagem genérica como `oi` → lista curta de produtos;
- FGTS, seguro, carro em garantia e financiamento continuam no WhatsApp;
- conversas CLT já em originação continuam no fluxo em que estavam.

## 2. Recuperação da contratação iniciada

### Segmentos

1. **Cadastro iniciado:** abriu o chat, mas não autorizou a consulta.
2. **Autorização pendente:** recebeu a autorização Facta, mas não concluiu.
3. **Oferta apresentada:** viu condições, mas não escolheu.
4. **Dados da proposta:** escolheu oferta, mas não terminou o cadastro.
5. **Assinatura pendente:** proposta criada, contrato ainda não assinado.
6. **Análise bancária:** não é abandono; enviar apenas atualização transacional.

### Cadência máxima

| Momento | Canal | Conteúdo | Regra |
|---|---|---|---|
| 20–30 min | chat | mantém o ponto exato e oferece continuar | somente se não avançou |
| 2 h | e-mail | link direto para retomar | um envio |
| 4 h | WhatsApp | lembrete curto | somente dentro da janela aberta pelo cliente ou com opt-in válido |
| 24 h | e-mail | ajuda sobre a objeção mais provável | não repetir a primeira mensagem |
| 72 h | WhatsApp | último convite | template Marketing, somente com opt-in; incluir saída |

Parar imediatamente quando houver avanço, assinatura, cancelamento, resposta negativa ou pedido de saída.

## 3. Mensagens por etapa

### Oferta não escolhida

**WhatsApp Marketing:** `felizcred_clt_simulacao_incompleta`

> Olá, {{1}}. Sua simulação de consignado CLT ficou incompleta. Se quiser continuar, seus dados já estão salvos. Toque abaixo para voltar ao ponto em que parou.

Botões: `Continuar simulação` e `Parar mensagens`.

### Assinatura pendente

**WhatsApp Utility:** `felizcred_clt_assinatura_pendente`

> Olá, {{1}}. A proposta {{2}} está aguardando sua revisão e assinatura. Consulte as condições antes de decidir e continue pelo botão abaixo.

Botão: `Revisar proposta`.

### Reativação da base antiga

**WhatsApp Marketing:** `felizcred_reapresentacao_novo_numero`

Usar somente com registro de opt-in para mensagens da FelizCred:

> Olá, {{1}}. Aqui é a FelizCred em nosso novo número de atendimento. Você já foi nosso cliente e pode consultar novamente as opções disponíveis. Quer iniciar um novo atendimento?

Botões: `Consultar opções` e `Parar mensagens`.

Sem opt-in comprovável, não disparar. Enviar primeiro e-mail com botão para o cliente iniciar a conversa no novo WhatsApp ou usar anúncio clique-para-WhatsApp.

## 4. E-mails

1. **2 h — retomar:** assunto `Sua simulação ficou salva`.
2. **24 h — esclarecer:** assunto `Ficou alguma dúvida sobre sua simulação?`.
3. **Base antiga — reopt-in:** assunto `A FelizCred está com um novo atendimento` e botão `Iniciar conversa no WhatsApp`.

Todo e-mail promocional deve identificar a FelizCred, explicar por que a pessoa recebeu a mensagem e oferecer descadastro funcional.

## 5. Captação futura em Google e Meta

### Google Search

- intenção: `empréstimo consignado CLT`, `crédito do trabalhador`, `simular empréstimo CLT`;
- anúncio → página CLT → chat aberto → autorização → oferta → proposta;
- a página precisa exibir prazo mínimo/máximo, taxa anual máxima equivalente e exemplo representativo do custo total antes de anunciar empréstimo pessoal;
- a conta precisa cumprir a verificação de serviços financeiros aplicável ao Brasil.

**Rascunho de anúncio responsivo:**

- títulos: `Simule seu Consignado CLT`, `Crédito do Trabalhador`, `Consulte pelo Chat`, `Atendimento FelizCred`, `Veja Condições Disponíveis`;
- descrições: `Consulte condições de consignado CLT pelo chat e acompanhe cada etapa.`; `Simulação sujeita à análise e às condições disponíveis para o seu perfil.`;
- caminho visível: `credito-clt/simulacao`;
- CTA: `Simular no chat`.

### Meta Ads

- anúncio clique-para-WhatsApp ou anúncio para o chat do site;
- promessa: consulta e acompanhamento, nunca “aprovação garantida”;
- registrar origem, campanha e consentimento por canal;
- retargeting somente para quem iniciou e não concluiu, excluindo assinados, cancelados e opt-outs.

**Rascunho de anúncio:**

- texto principal: `Trabalha com carteira assinada? Consulte pelo chat as condições disponíveis para o consignado CLT. Você acompanha cada etapa e só informa os dados quando forem necessários.`;
- título: `Simule seu consignado CLT`;
- descrição: `Consulta sujeita à análise e disponibilidade.`;
- CTA: `Saiba mais` para o site ou `Enviar mensagem` no anúncio clique-para-WhatsApp.

## 6. Eventos e painel

- `clt_direcionado_site`;
- `chat_aberto`;
- `autorizacao_pendente`;
- `oferta_abandonada`;
- `cadastro_abandonado`;
- `assinatura_pendente`;
- `followup_email_2h`;
- `followup_whatsapp_4h`;
- `followup_email_24h`;
- `followup_whatsapp_72h`;
- `retomou_apos_followup`;
- `optout_whatsapp` e `optout_email`.

O painel deve mostrar conversão e descadastro por etapa, canal, campanha e modelo de mensagem.

## 7. Regras de conformidade

- Política oficial WhatsApp Business: https://business.whatsapp.com/policy/preview?lang=pt_BR
- Guia da ANPD sobre legítimo interesse: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_hipoteses_legais_tratamento_dados_pessoais_legitimo_interesse
- Política Google Ads para produtos financeiros: https://support.google.com/adspolicy/answer/2464998?hl=pt-BR
- Verificação de serviços financeiros no Brasil: https://support.google.com/adspolicy/answer/15332527?co=GENIE.CountryCode%3DBR

