# Acesso à Facta (modo direto)

## Situação atual (desde 20/10/2026)

**Não usamos mais ngrok nem túnel.** O servidor do Render fala direto com a API da Facta
(`FACTA_DIRECT=true`). A Facta aceita no máximo dois IPv4 individuais na lista de acesso; hoje
estão cadastrados:

- IP de saída do Render (`meuwhats`): `74.220.48.71` (conferir em `GET /painel/api/facta/ip-saida`);
- IP deste computador: `179.221.201.100`, para o lote de consultas offline.

Se o Render trocar de IP, as consultas online falham com erro de acesso: ler o IP novo na rota
acima e atualizar o cadastro no painel da Facta. O mesmo vale se o IP de casa mudar (conferir
em `https://api.ipify.org`).

## Como rodar o lote offline neste computador

Não precisa de ponte, túnel nem servidor ligado. Usa as credenciais salvas nas variáveis de
ambiente do usuário do Windows (`FACTA_USERNAME`, `FACTA_PASSWORD`, `FACTA_ENV`):

```powershell
$env:FACTA_DIRECT = "true"
node scripts/consultar-lote-facta.js cpfs.txt saida.json
```

- `cpfs.txt`: um CPF por linha. `saida.json`: resposta bruta de cada CPF (fica fora do Git).
- O script espera 3,2 s entre consultas (a Facta exige no mínimo 3 s). Parar se vier 429/bloqueio.
- Se vier erro de IP/acesso, o IP de casa mudou: atualizar na Facta (não contornar).

## A ponte local (`facta-bridge/`) — só legado

`facta-bridge/server.js` continua no repositório porque o modo direto reutiliza o código dele
(`factaRequest`). O servidor HTTP da ponte (`start.ps1`, `watchdog.ps1`, `start-all.ps1`) não é
necessário; a tarefa do Windows "FelizCred Facta Bridge" está desativada de propósito. As
variáveis `FACTA_BRIDGE_URL`/`FACTA_BRIDGE_SECRET` só servem se `FACTA_DIRECT` for removido.

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

- [x] Credenciais Facta renovadas e armazenadas fora do repositório.
- [x] IPs do Render e deste computador cadastrados no painel Facta.
- [x] Modo direto (`FACTA_DIRECT=true`) ativo no Render; ngrok e túnel removidos.
- [x] Validar e classificar respostas da base offline.
- [x] Implementar no chat a jornada online até a geração do link de assinatura.
- [x] Implementar o acompanhamento da proposta após a assinatura.
- [ ] Obter da Facta a liberação do token da API online bloqueado pelo Cloudflare.
- [ ] Confirmar com a Facta o `login_certificado` de produção e se há código master ou gerente obrigatório.
- [ ] Homologar uma proposta completa antes de liberar a criação de propostas em produção.
- [ ] IP de saída do Render pode mudar (plano gratuito): considerar IP fixo no futuro.
