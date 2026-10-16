# Estudo completo — funil CLT multibanco

Data: 16/10/2026

## Objetivo

Transformar o chat do site no canal principal de contratação assistida do consignado CLT, com:

- coleta progressiva de dados;
- tentativa automática em todos os bancos com API habilitada;
- consentimento específico antes de compartilhar dados com cada novo banco;
- reaproveitamento dos dados já informados;
- continuidade coordenada por chat, WhatsApp e e-mail;
- atendimento humano como última rota operacional, sem impedir o acesso quando o cliente insiste;
- medição de entrada, avanço, skip, silêncio, recuperação, proposta, assinatura e pagamento.

O sistema não deve prometer aprovação. Falha técnica, ausência de oferta e reprovação são resultados
distintos e precisam aparecer dessa forma para o cliente e para a equipe.

## Princípios da experiência

1. Pedir somente o dado necessário para liberar a próxima resposta útil.
2. Entregar valor antes de pedir dados cadastrais completos.
3. Nunca pedir novamente um dado válido já armazenado.
4. Não trocar de banco silenciosamente: pedir aceite específico, simples e registrado.
5. Uma falha técnica não é uma negativa de crédito.
6. Sempre mostrar o que está acontecendo e qual será o próximo passo.
7. Um CTA principal por tela ou mensagem.
8. Não apresentar “falar com atendimento” como fuga padrão antes de esgotar os bancos habilitados.
9. Se o cliente pedir uma pessoa, entender a dúvida em uma pergunta curta e tentar resolvê-la sem
   bloquear o pedido. Na segunda insistência, ou em tema sensível, encaminhar.
10. Contratação só termina em um estado explícito: pago/concluído, encerrado, sem opção após todos
    os bancos, desistência ou atendimento humano.

## Framework operacional: Capture → Qualifique → Roteie → Recupere → Converta

O funil combina gestão de leads por estágio com recuperação de falhas:

1. **Capture:** nome e celular.
2. **Qualifique:** tempo de carteira e CPF.
3. **Roteie:** escolher o próximo banco elegível pela configuração.
4. **Recupere:** diante de falha/sem oferta, pedir consentimento e seguir para o próximo banco.
5. **Converta:** oferta, escolha, dados completos, proposta, assinatura e pagamento.

O funil é aberto: clientes podem entrar pelo site, WhatsApp, e-mail de retomada ou atendimento e
continuar a mesma jornada. A identidade é conciliada por telefone normalizado e CPF com proteção
adequada; nenhuma tela deve exibir CPF completo no painel de analytics.

## Jornada progressiva do cliente

### Etapa 1 — Entrada

Campos:

- primeiro nome ou nome pelo qual deseja ser chamado;
- celular com DDD;
- aceite separado para receber atualizações desta simulação no WhatsApp.

Não pedir e-mail nem CPF na primeira tela.

Copy:

> Vamos verificar suas possibilidades de consignado CLT. Começamos com duas informações rápidas.

CTA: `Ver minhas possibilidades`

### Etapa 2 — Qualificação curta

Pergunta:

> Você trabalha com carteira assinada há mais de 3 meses?

Respostas: `Sim`, `Ainda não`, `Não tenho certeza`.

- Sim: pedir CPF.
- Ainda não: explicar a regra atual e oferecer aviso futuro, sem pedir CPF.
- Não tenho certeza: explicar em uma frase onde conferir e permitir continuar ou encerrar.

### Etapa 3 — Primeira consulta

Campo: CPF.

Copy:

> Usaremos seu CPF para consultar vínculo e margem. Isso não cria empréstimo nem contrato.

Antes do envio, informar qual instituição receberá os dados e registrar consentimento.

### Etapa 4 — Orquestrador multibanco

Os bancos não devem ficar codificados na interface. Usar um cadastro de provedores:

| Campo | Exemplo |
|---|---|
| `provider_id` | `facta`, `novosaque`, `unnotech` |
| `produto` | `CLT` |
| `ativo` | verdadeiro/falso |
| `ambiente` | sandbox/produção |
| `prioridade` | 10, 20, 30 |
| `health_status` | saudável, degradado, indisponível |
| `dados_minimos` | CPF, celular, nascimento etc. |
| `exige_autorizacao` | verdadeiro/falso |
| `consent_version` | versão do texto aprovado |
| `timeout_ms` | limite por chamada |
| `retry_policy` | tentativas permitidas |

Regras de escolha:

1. somente produção e `ativo=true`;
2. pular banco já tentado nesta jornada;
3. pular banco com circuito aberto por indisponibilidade sistêmica;
4. respeitar prioridade comercial sem esconder do cliente qual instituição será consultada;
5. não enviar dados a outro banco sem consentimento específico;
6. falha técnica pode seguir para outro banco;
7. “sem oferta” pode seguir para outro banco;
8. inconsistência cadastral deve pedir correção antes de trocar de banco;
9. proposta já criada bloqueia nova proposta automática até decisão explícita do cliente.

### Etapa 5 — Recuperação entre bancos

Mensagem padrão:

> A {{banco_anterior}} não conseguiu apresentar uma condição agora. Isso não significa que seu
> crédito foi negado. Podemos consultar a {{proximo_banco}} usando os dados que você já informou.

CTA principal: `Consultar na {{proximo_banco}}`

CTA secundário: `Agora não`

Consentimento:

> Autorizo a FelizCred a compartilhar {{lista_dados}} com a {{proximo_banco}}, exclusivamente para
> consultar uma possibilidade de consignado CLT. Esta consulta não cria contrato.

O aceite deve guardar: texto, versão, banco, finalidade, dados compartilhados, data/hora, canal e
identificador da jornada.

### Etapa 6 — Dados adicionais para simular

Somente quando a API exigir, agrupar os campos necessários em uma tela curta e explicar por quê.

Exemplo: data de nascimento e renda. Não pedir endereço, RG, conta bancária, patrimônio ou filiação
antes de existir oferta, salvo obrigação técnica comprovada do banco para a simulação.

### Etapa 7 — Oferta

Mostrar instituição, valor líquido estimado, parcelas, taxa, CET e seguro quando informados.
Explicar que os valores ainda podem passar por validação final. Registrar oferta exibida e escolhida.

### Etapa 8 — Proposta real

Somente após escolha da oferta:

1. identificação complementar;
2. endereço;
3. forma de recebimento;
4. revisão dos dados e da oferta;
5. consentimento para criar proposta real;
6. assinatura no ambiente seguro;
7. acompanhamento até pagamento ou encerramento.

## Pedido por atendimento humano

Detectar variações como “humano”, “pessoa”, “atendente”, “atendimento”, “quero falar com alguém”,
incluindo erros ortográficos comuns. Não responder com menu longo.

Primeiro pedido:

> Claro. Em poucas palavras, qual é sua dúvida? Se for para consultar o CLT, consigo fazer agora
> por aqui e um atendente faria essa mesma consulta.

Classificar a resposta:

- dúvida sobre segurança/privacidade: responder e manter CTA da etapa atual;
- dúvida sobre taxa/valor: explicar que precisa consultar para mostrar números reais;
- dificuldade no formulário: orientar o campo e preservar os dados;
- reclamação, fraude, cancelamento, titularidade, acessibilidade ou pedido de exclusão: humano imediato;
- segunda solicitação explícita por pessoa: humano, mesmo sem esgotar bancos;
- silêncio depois da pergunta: não marcar como atendimento; manter a jornada recuperável.

Quando todos os bancos habilitados terminarem sem oferta:

> Consultamos todas as instituições disponíveis no momento e não encontramos uma condição. Vou
> deixar seu caso organizado para nossa equipe conferir se existe outra alternativa.

Nesse ponto o handoff é automático, com resumo completo e sem pedir que o cliente repita a história.

## Estados finais por banco

| Classe | Exemplos | Próxima ação |
|---|---|---|
| Sucesso | oferta disponível | mostrar oferta |
| Ação do cliente | autorização/assinatura pendente | lembrete contextual |
| Sem produto | sem margem, sem oferta, inelegível | oferecer próximo banco |
| Corrigível | CPF divergente, celular inválido | corrigir o dado |
| Técnico | timeout, 5xx, token, indisponível | retry controlado ou próximo banco |
| Definitivo | proposta paga, cancelada pelo cliente | encerrar jornada |
| Sensível | suspeita de fraude, contestação | humano imediato |

## Templates de WhatsApp a aprovar

Usar categoria Utility quando a mensagem for atualização de uma solicitação iniciada pelo cliente.
Templates de reengajamento promocional devem ser Marketing e ter opt-out. Fora da janela de 24 horas,
a plataforma exige template aprovado para iniciar mensagem.

### 1. `clt_continuar_consulta`

> Olá, {{1}}. Sua consulta CLT na FelizCred ficou pausada. Você pode continuar de onde parou, sem
> preencher tudo novamente.

Botão URL: `Continuar consulta`

### 2. `clt_autorizacao_pendente`

> Olá, {{1}}. Falta autorizar a consulta na {{2}} para verificarmos suas condições de CLT. A
> autorização não cria contrato.

Botão URL: `Autorizar consulta`

### 3. `clt_outro_banco_disponivel`

> Olá, {{1}}. A {{2}} não apresentou uma condição agora. Podemos consultar a {{3}} usando os dados
> já informados, após seu aceite.

Botão URL: `Ver outra opção`

### 4. `clt_dados_pendentes`

> Olá, {{1}}. Encontramos uma possibilidade de CLT. Faltam alguns dados para calcular as condições.
> Continue com segurança no site da FelizCred.

Botão URL: `Completar dados`

### 5. `clt_oferta_disponivel`

> Olá, {{1}}. Sua consulta encontrou uma condição na {{2}}. Revise valores, parcelas e demais
> informações antes de decidir.

Botão URL: `Revisar condição`

### 6. `clt_proposta_para_revisao`

> Olá, {{1}}. A proposta {{2}} está pronta para revisão na {{3}}. Confira taxa, CET, parcelas e valor
> líquido antes de assinar.

Botão URL: `Revisar proposta`

### 7. `clt_assinatura_pendente`

> Olá, {{1}}. A proposta {{2}} ainda aguarda sua assinatura. Se estiver de acordo com as condições,
> conclua no ambiente seguro da {{3}}.

Botão URL: `Revisar e assinar`

### 8. `clt_proposta_em_analise`

> Olá, {{1}}. Sua assinatura foi recebida e a proposta {{2}} está em análise na {{3}}. Não é preciso
> preencher os dados novamente.

Botão URL: `Acompanhar proposta`

### 9. `clt_proposta_concluida`

> Olá, {{1}}. A proposta {{2}} foi concluída pela {{3}}. Confira o crédito na conta informada e veja
> os detalhes no acompanhamento.

Botão URL: `Ver acompanhamento`

### 10. `clt_proposta_encerrada`

> Olá, {{1}}. A proposta {{2}} foi encerrada pela {{3}}. Consulte o acompanhamento para ver o status
> e, quando disponível, outras opções.

Botão URL: `Ver detalhes`

### 11. `clt_todos_bancos_consultados`

> Olá, {{1}}. Concluímos as consultas disponíveis e não encontramos uma condição neste momento. A
> equipe FelizCred pode revisar seu caso sem você repetir os dados.

Botão de resposta: `Quero uma revisão`

### 12. `clt_atendimento_assumiu`

> Olá, {{1}}. Seu caso foi encaminhado para {{2}}, da FelizCred, que já recebeu o histórico da sua
> consulta. Você não precisa explicar tudo novamente.

Cada template deve ter exemplo realista sem CPF, margem, taxa ou dados bancários. Guardar nome,
idioma, categoria, versão, status da aprovação e data da última alteração no painel.

## E-mail de continuidade

E-mail é contingência, não duplicação imediata do WhatsApp. Disparar apenas com opt-in/base legal
adequada e quando o endereço já tiver sido coletado por necessidade da jornada.

| Gatilho | Momento | Assunto | CTA |
|---|---:|---|---|
| consulta pausada | 2 horas | Continue sua consulta CLT | Continuar |
| outro banco | 6 horas | Podemos verificar outra instituição | Ver opção |
| oferta disponível | imediato se WhatsApp falhar | Encontramos uma condição para você revisar | Revisar |
| assinatura pendente | 24 horas | Sua proposta ainda aguarda revisão | Revisar proposta |
| último lembrete | 72 horas | Quer continuar sua consulta? | Retomar |

Não enviar os cinco e-mails para quem já avançou. Todo disparo reavalia o estado atual antes do envio.

## Silêncio, skip e abandono

“Parou de responder” não pode ser inferido apenas porque a página fechou. Definições:

- **skip:** cliente clica “Agora não”, fecha uma etapa explicitamente ou escolhe continuar depois;
- **silêncio:** não existe nova ação após um prazo configurado para a etapa;
- **abandono provável:** silêncio após todas as tentativas permitidas de recuperação;
- **abandono confirmado:** cliente escolhe encerrar ou opt-out;
- **falha operacional:** sistema/banco impediu avanço; nunca contar como abandono do cliente.

Prazos iniciais para teste:

| Etapa | Silêncio | Recuperação 1 | Recuperação 2 | Encerramento automático |
|---|---:|---:|---:|---:|
| nome/celular | 15 min | nenhuma, ainda sem opt-in | — | 24 h |
| CPF/consentimento | 20 min | WhatsApp em 30 min | e-mail em 6 h | 72 h |
| autorização externa | 30 min | WhatsApp em 30 min | WhatsApp em 24 h | 7 dias |
| consentimento outro banco | 30 min | WhatsApp em 2 h | e-mail em 24 h | 72 h |
| dados adicionais | 30 min | WhatsApp em 2 h | e-mail em 24 h | 72 h |
| oferta exibida | 1 h | WhatsApp em 2 h | e-mail em 24 h | 7 dias |
| assinatura | 2 h | WhatsApp em 2 h | WhatsApp/e-mail em 24 h | conforme validade |

Esses tempos são hipóteses. O painel deve permitir alterá-los sem deploy e comparar coortes.

## Modelo de eventos

Criar evento append-only, não apenas status atual:

```text
funnel_event_id
journey_id
conversation_id
anonymous_or_contact_id
channel                 site | whatsapp | email | system | agent
event_name
step_id
provider_id
provider_attempt
result_class
reason_code
consent_version
template_name
campaign_source
campaign_medium
campaign_id
session_id
occurred_at
metadata_json           sem segredos e sem CPF em claro
```

Eventos mínimos:

```text
clt_entry_viewed
clt_started
contact_minimum_submitted
tenure_answered
cpf_requested
cpf_submitted
provider_consent_viewed
provider_consent_accepted
provider_consent_declined
provider_attempt_started
provider_authorization_sent
provider_authorization_completed
provider_result_received
provider_failed_technical
provider_no_offer
provider_offer_available
fallback_offered
fallback_accepted
fallback_declined
additional_data_requested
additional_data_submitted
offer_viewed
offer_selected
proposal_consent_accepted
proposal_created
signature_opened
signature_completed
proposal_in_analysis
proposal_completed
proposal_cancelled
human_intent_detected
human_question_captured
human_handoff_started
step_skipped
silence_detected
recovery_sent
recovery_delivered
recovery_read
recovery_clicked
journey_abandoned_probable
journey_abandoned_confirmed
```

`reason_code` deve ser controlado: `timeout`, `provider_5xx`, `auth_failed`, `no_margin`, `not_eligible`,
`no_offer`, `invalid_data`, `customer_declined`, `customer_silent`, `duplicate_proposal`, `manual_review`.

## Painel de analytics

### Visão executiva

- entradas, CPFs enviados, ofertas, propostas, assinaturas e pagamentos;
- conversão total e por origem/campanha;
- valor líquido contratado e ticket médio, quando disponível;
- tempo mediano e percentil 90 até oferta, assinatura e pagamento;
- clientes recuperados por segundo/terceiro banco;
- falhas operacionais separadas de recusas comerciais.

### Funil aberto e fechado

Funil principal:

```text
Iniciou
→ enviou contato mínimo
→ qualificou
→ enviou CPF
→ aceitou banco
→ recebeu resultado
→ viu oferta
→ escolheu oferta
→ criou proposta
→ assinou
→ concluiu/pagou
```

Mostrar em cada transição:

- quantidade;
- conversão;
- drop-off absoluto e percentual;
- tempo mediano;
- quantos foram skip, silêncio, falha técnica ou sem oferta;
- comparação com período anterior.

O modo aberto mede quem entrou por WhatsApp/e-mail no meio do processo. O fechado mede somente quem
percorreu a sequência desde o início.

### Waterfall por banco

Para cada provedor:

- tentativas;
- disponibilidade técnica;
- autorização concluída;
- elegibilidade;
- oferta;
- proposta;
- assinatura;
- pagamento;
- tempo de resposta;
- erro por código;
- recuperação gerada para o banco seguinte.

Relatório essencial: “de cada 100 falhas na Facta, quantos aceitaram Novo Saque, quantos receberam
oferta e quantos concluíram?”.

### Mapa de abandono

Tabela clicável:

| Etapa onde parou | Clientes | % do funil | Silêncio | Skip | Erro técnico | Último banco | Ação |
|---|---:|---:|---:|---:|---:|---|---|

Ao clicar, abrir lista de jornadas com último evento, tempo parado, canal disponível e próxima ação
segura. Não exibir CPF completo.

### Recuperação multicanal

Por template e canal:

- enviado, entregue, lido, clicado, respondido;
- avanço para a etapa seguinte;
- proposta e pagamento atribuídos;
- opt-out e bloqueio;
- tempo até retorno;
- custo por recuperação e receita recuperada.

### Pedidos por humano

- frases mais usadas;
- etapa em que surgiram;
- dúvida classificada;
- resolvido pelo bot;
- insistiu e foi transferido;
- tempo até humano;
- conversão posterior;
- reclamações e temas sensíveis separados.

## Fórmulas

```text
conversao_etapa = usuarios_que_chegaram_na_proxima / usuarios_na_etapa_atual
abandono_etapa = 1 - conversao_etapa
taxa_skip = usuarios_com_step_skipped / usuarios_na_etapa
taxa_silencio = usuarios_com_silence_detected / usuarios_na_etapa
recuperacao = usuarios_que_avancaram_apos_recovery / usuarios_que_receberam_recovery
fallback_acceptance = fallback_accepted / fallback_offered
fallback_offer_rate = oferta_no_banco_seguinte / fallback_accepted
recuperacao_multibanco = concluidos_apos_fallback / jornadas_sem_sucesso_no_primeiro_banco
falha_tecnica_provider = tentativas_com_falha_tecnica / tentativas_provider
```

Não usar média isolada para tempo; mostrar mediana e P90.

## Alertas operacionais

- provedor com falha técnica acima do limite em 15 minutos: abrir circuito e pular temporariamente;
- autorização enviada sem conclusão acima do SLA;
- oferta exibida sem escolha;
- proposta criada sem assinatura;
- assinatura concluída sem avanço do banco;
- WhatsApp com queda de entrega ou aumento de bloqueio;
- template reprovado/pausado;
- fila humana acima do SLA;
- jornada sem próximo passo válido.

## Testes A/B permitidos

Testar uma variável por vez:

1. explicação curta vs. detalhada antes do CPF;
2. botão “Consultar outra instituição” vs. “Ver outra opção”;
3. mostrar nome do próximo banco no título vs. no texto;
4. lembrete em 30 vs. 60 minutos;
5. e-mail após 6 vs. 24 horas.

Não testar ocultação de consentimento, promessa de aprovação, urgência falsa ou pré-seleção de aceite.

## Ordem de implementação

1. Validar credenciais de produção e contrato comercial de cada API.
2. Criar cadastro dinâmico de provedores e health/circuit breaker.
3. Criar `journey_id`, tentativas por provedor e tabela append-only de eventos.
4. Implementar coleta progressiva e consentimento versionado.
5. Implementar waterfall Facta → Novo Saque → Unnotech apenas quando cada uma estiver em produção.
6. Criar scheduler de silêncio e recuperação idempotente.
7. Submeter e aprovar os 12 templates no WhatsApp Manager.
8. Implementar e-mails condicionais ao estado atual.
9. Ampliar o painel Funil com drop-off, motivos, waterfall e coortes.
10. Testar em sandbox com CPFs de teste e depois liberar produção por feature flag gradual.

## Critérios para lançamento

- nenhum banco sandbox pode receber cliente real;
- consentimentos auditáveis;
- mensagens idempotentes, sem duplicação;
- opt-out processado imediatamente;
- dados preservados ao trocar de canal;
- retomada abre exatamente na etapa pendente;
- falha de um banco não apaga histórico nem dados válidos;
- atendimento recebe resumo completo;
- dashboards distinguem comportamento do cliente de falha operacional;
- teste ponta a ponta em Chrome móvel e desktop;
- plano de desligamento imediato por provedor e por template.

## Referências

- LGPD, especialmente finalidade, necessidade, transparência, consentimento e compartilhamento:
  https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Política do WhatsApp Business: https://whatsappbusiness.com/policy/
- Gestão de chats comerciais e templates iniciados por empresas:
  https://about.fb.com/news/2025/04/ways-to-manage-your-businesses-chats-on-whatsapp/
- GA4 Funnel Exploration e abandono entre etapas:
  https://support.google.com/analytics/answer/9327974
- GA4 Path Exploration para descobrir loops e caminhos não previstos:
  https://support.google.com/analytics/answer/9317498
- Portal de integração Novo Saque: https://developers.novosaque.com.br/-1945918m0

