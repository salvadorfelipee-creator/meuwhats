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

## Estado da implantação

- [x] Conta e domínio gratuito do ngrok.
- [x] Credenciais Facta renovadas e armazenadas fora do repositório.
- [x] IP público cadastrado no painel Facta.
- [x] Ponte local autenticada e lista fechada de endpoints.
- [x] URL e segredo configurados no Render.
- [x] Inicialização automática no login do Windows.
- [x] Suspensão e hibernação automáticas desativadas para não interromper a ponte.
- [x] Teste ponta a ponta com documento deliberadamente inválido (autenticação e IP aceitos).
- [ ] Validar o formato das respostas com um CPF autorizado pelo titular.
- [ ] Ligar o fluxo do chat à Facta depois dessa validação.
- [ ] Migrar para infraestrutura com IP fixo e disponibilidade contínua.
