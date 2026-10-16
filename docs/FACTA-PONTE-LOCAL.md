# Ponte local da Facta (solução provisória)

## Situação

A Facta aceita no máximo dois IPv4 individuais na lista de acesso. O serviço `meuwhats`, no
plano gratuito do Render, sai por faixas compartilhadas e pode trocar de IP. Por isso, as
requisições à Facta passam provisoriamente por este computador, cujo IP público é cadastrado na
Facta.

> **Pendência obrigatória:** migrar a ponte para uma infraestrutura com IP fixo quando a operação
> estiver estabilizada. Esta solução depende de o computador permanecer ligado, conectado à
> internet e sem suspensão.

Configuração inicial realizada em 16/10/2026:

- domínio fixo gratuito: `https://anatomist-upward-flashy.ngrok-free.dev`;
- IP cadastrado na Facta: `179.221.201.100`;
- tarefa do Windows: `FelizCred Facta Bridge`;
- serviço Render: `meuwhats`;
- produção da API Facta permanece ativa.

## Arquitetura

`Render -> túnel HTTPS autenticado -> facta-bridge (127.0.0.1:8787) -> API Facta`

- As credenciais da Facta ficam nas variáveis protegidas do usuário do Windows. O arquivo
  `facta-bridge/.env` é aceito apenas para desenvolvimento e permanece ignorado pelo Git.
- O Render recebe somente a URL do túnel e uma chave compartilhada.
- A ponte só permite uma lista fechada de rotas Facta; ela não é um proxy aberto.
- O token da Facta é mantido em memória e renovado antes de expirar.

## Dependências operacionais

1. Manter o computador ligado e impedir suspensão automática.
2. Manter a ponte e o túnel configurados para iniciar com o Windows.
3. Se o IP público da internet mudar, atualizar o cadastro no painel da Facta.
4. Não enviar nem versionar o arquivo `.env`.
5. Se o computador for desligado, nenhuma consulta nova à Facta funcionará até ele voltar.

## Diagnóstico

- Local: `http://127.0.0.1:8787/health`
- Público: `https://anatomist-upward-flashy.ngrok-free.dev/health`
- O endpoint público `/health` deve responder `ok: true` enquanto computador e túnel estiverem ativos.
- Erros da Facta são registrados sem imprimir usuário, senha ou token.

## Migração futura

Substituir `FACTA_BRIDGE_URL` por um gateway hospedado com IPv4 de saída reservado. O módulo
`facta.js` e o restante do atendimento não precisarão conhecer as credenciais da Facta nem ser
reescritos.

## Fluxo do chat do site

O atendimento iniciado diretamente no chat não usa a base offline. Ele segue a jornada online:

1. O cliente confirma que possui mais de três meses no emprego atual e informa CPF e celular.
2. A API solicita a autorização e a Facta envia o link ao WhatsApp do cliente.
3. Após a autorização, o sistema consulta vínculo, margem e operações disponíveis.
4. O chat apresenta prazo, parcela, valor líquido, taxa informada e seguro quando houver.
5. Ao escolher uma condição, a API consulta a política de crédito e grava a simulação.
6. Somente depois da política aprovada o cliente preenche os dados pessoais, endereço, conta e
   chave Pix exigidos pela Facta.
7. Com consentimento explícito, a API cadastra os dados, gera uma proposta real e devolve o link
   para revisão e assinatura no ambiente da Facta.
8. Depois da assinatura, o chat consulta `andamento-propostas` pelo código AF. Ele mostra o status
   retornado pela Facta, identifica conclusão/pagamento e, em cancelamentos, busca a última
   ocorrência para orientar o cliente sem fazê-lo preencher tudo novamente.

O chat nunca apresenta margem ou operação disponível como aprovação. Antes da assinatura, o
cliente é orientado a revisar valor, parcelas, taxa, CET e demais condições no contrato.

A consulta offline permanece disponível para outros fluxos. Exemplo: se a tentativa na Novo
Saque não concluir, o sistema poderá consultar silenciosamente a base offline da Facta e sugerir
uma nova simulação somente quando houver vínculo elegível e margem positiva.

### Estados que exigem ação da equipe

- `erro_autorizacao`: conferir telefone e o vínculo entre telefone e CPF.
- `erro_consulta`: conferir indisponibilidade da Dataprev/virada de folha.
- `politica_reprovada`: explicar que a condição não passou pela política interna.
- `erro_integracao`: conferir token, IP e liberação do Cloudflare antes de tentar novamente.

Em 16/10/2026, a geração de token no serviço online da Facta estava sendo recusada pelo
Cloudflare com HTTP 403. A consulta offline funcionava. Enquanto a Facta não liberar esse acesso,
o fluxo online informa indisponibilidade e permite encaminhar o caso ao atendente; ele não usa a
base offline para fingir que houve autorização online.

### Variáveis que liberam a contratação real

- `FACTA_LOGIN_CERTIFICADO`: login certificado confirmado pela Facta para gravar a simulação.
- `FACTA_PROPOSAL_ENABLED=true`: libera as etapas 2 e 3, que cadastram cliente e criam proposta
  real. Deve permanecer desligada durante testes incompletos.
- `FACTA_SITE_WHATSAPP_ANALISE_TEMPLATE`, `FACTA_SITE_WHATSAPP_CONCLUIDA_TEMPLATE` e
  `FACTA_SITE_WHATSAPP_ENCERRADA_TEMPLATE`: nomes dos templates aprovados na Meta para avisar
  mudanças de etapa mesmo quando a janela de 24 horas do WhatsApp estiver fechada. Sem eles, o
  acompanhamento continua normalmente no chat e no painel, mas esses três avisos não são enviados.
- `FACTA_CODIGO_MASTER` e/ou código de gerente só devem ser adicionados se a Facta confirmar que
  são obrigatórios para este cadastro.

As credenciais e o host configurados apontam para produção, e o portal mostra produção ativa.
Isso não significa que todo o produto esteja liberado: token online, perfil do usuário, IP,
`login_certificado` e parâmetros do convênio precisam funcionar juntos.

## Estado da implantação

- [x] Conta e domínio gratuito do ngrok.
- [x] Credenciais Facta renovadas e armazenadas fora do repositório.
- [x] IP público cadastrado no painel Facta.
- [x] Ponte local autenticada e lista fechada de endpoints.
- [x] URL e segredo configurados no Render.
- [x] Inicialização automática no login do Windows.
- [x] Suspensão e hibernação automáticas desativadas para não interromper a ponte.
- [x] Teste ponta a ponta com documento deliberadamente inválido (autenticação e IP aceitos).
- [x] Validar e classificar respostas da base offline.
- [x] Implementar no chat a jornada online até a geração do link de assinatura.
- [x] Implementar o acompanhamento da proposta após a assinatura.
- [ ] Obter da Facta a liberação do token da API online bloqueado pelo Cloudflare.
- [ ] Confirmar com a Facta o `login_certificado` de produção e se há código master ou gerente obrigatório.
- [ ] Homologar uma proposta completa antes de liberar a criação de propostas em produção.
- [ ] Migrar para infraestrutura com IP fixo e disponibilidade contínua.
