# Projeto: Plataforma provedora (tipo ManyChat) — WhatsApp + Instagram + Facebook + IA

> **Status: planejamento, NÃO iniciado.** Este arquivo é o prompt/briefing completo
> pra usar quando decidirmos começar a construir. Quando o usuário disser algo como
> "vamos começar o projeto do provedor" ou "bora fazer o manychat nosso", **ler este
> arquivo inteiro antes de qualquer código** e seguir como plano de execução — ele
> reúne tudo que já foi decidido pra não precisar re-perguntar nada.

## 1. O que é

Uma ferramenta própria, no estilo ManyChat/GoHighLevel/Zenvia, pra vender como
produto pra outras empresas: um painel onde o cliente conecta o WhatsApp,
Instagram e Facebook dele e ganha automação de conversas (incluindo criação de
conteúdo com IA). Separado de tudo que já existe (Felizcred, Cota Certa,
Massagem Vip são clientes/contas nossas — isso aqui é a ferramenta que
viraria produto pra vender pra terceiros).

## 2. Modelo de negócio (já decidido)

- **Cada cliente paga a Meta diretamente** pelo uso das mensagens (conversas) —
  a conta do WhatsApp Business dele fica no Business Manager e cartão *dele*,
  não nosso. Isso acontece através do fluxo de conexão (Embedded Signup, ver
  seção 4) — o cliente autoriza nosso app a operar a conta dele, mas quem paga
  a Meta é ele.
- **Nós cobramos só a mensalidade da ferramenta** (a automação/IA/painel) —
  igual o ManyChat cobrava US$15/mês separado do custo de mensagem.
- **Nós não pagamos nada pra Meta** só por sermos provedores — não existe taxa
  de plataforma/licença de desenvolvedor. O único gasto nosso com a Meta seria
  se decidíssemos anunciar o próprio produto (gasto de anúncio, opcional).

## 3. O que muda tecnicamente (o ponto que quebra com o que já existe)

- **WhatsApp: migração obrigatória pro WhatsApp Business Platform (Cloud API)**.
  O app comum do celular (que usamos hoje pra Felizcred/Cota Certa/Massagem Vip)
  só serve pra 1 número operado manualmente — não dá pra construir um produto
  multi-cliente em cima dele. Isso é o oposto da decisão tomada pra Massagem Vip
  (ficar no app comum) — aqui, pra virar provedor, não tem escolha.
- Instagram e Facebook Messenger entram via **Instagram Messaging API** e
  **Messenger Platform API** (mesma família de Graph API que já usamos pros
  anúncios, só que para mensageria).
- "Criação com IA" no Facebook (anúncios gerados por IA) não exige nada
  disso — são ferramentas normais do Gerenciador de Anúncios, sem requisito
  de virar provedor.

## 4. Passo a passo técnico necessário

1. **Business Verification** da empresa no Business Manager (CNPJ, documentos,
   comprovante de endereço) — grátis, só burocracia/tempo.
2. **App Review** de cada permissão de mensageria, com vídeo de demonstração,
   política de privacidade e termos de uso publicados:
   - `whatsapp_business_management`, `whatsapp_business_messaging`
   - `instagram_manage_messages`
   - `pages_messaging`
3. **Embedded Signup**: implementar o fluxo OAuth "Conectar com Facebook" que
   permite o cliente vincular o WhatsApp/Instagram/Página dele ao nosso app
   sem passar senha nem token manualmente pra gente — é a telinha que o
   ManyChat mostra na hora de conectar.
4. (Mais pra frente, não bloqueante no início) Virar **Tech Provider / Solution
   Partner** da Meta pra ganhar mais volume/qualidade de conta conforme o
   produto crescer.

## 5. Infraestrutura

- **Servidor**: hoje estamos no plano **grátis do Render** (hiberna sem
  tráfego, contornado com ping automático — ver README). Pra um produto pago
  de verdade, precisa subir pro plano pago (Starter, ~US$7/mês) — evita
  hibernar e dá CPU/RAM garantidos. Isso já resolve a maior parte do problema
  de confiabilidade.
- **Banco de dados**: já usamos **Turso** (SQLite hospedado, não é arquivo
  local) — escala bem pra esse volume, só olhar limite do plano grátis se o
  uso crescer muito.
- **Armazenamento de mídia — CORREÇÃO PENDENTE, já vale pro projeto atual,
  não só pro provedor**: hoje imagens/áudios/vídeos recebidos no WhatsApp são
  salvos em disco local (`media/`, listado no `.gitignore`). O Render usa
  disco **efêmero** — todo `git push` reconstrói o servidor e apaga essa
  pasta. Ou seja, mídia dos clientes está sendo perdida a cada deploy, hoje,
  com um número só. Precisa migrar pra um armazenamento de objetos permanente
  (ex.: Cloudflare R2, compatível com S3, custo baixo) antes de escalar pra
  múltiplos clientes — e vale corrigir isso já, independente do projeto do
  provedor. Meta só guarda mídia por pouco tempo no servidor dela (mídia
  recebida expira rápido, por isso qualquer ferramenta tipo ManyChat que
  "guarda pra sempre" faz isso baixando e armazenando por conta própria assim
  que a mensagem chega).

## 6. Escala — "100 clientes pagantes aguenta?"

Sim, tranquilamente, tecnicamente falando:

- Servidor Node.js é I/O-bound (webhook + chamada de API), não pesado — um
  único servidor pago aguenta 100 clientes numa boa. Múltiplas instâncias só
  viram necessárias em escala muito maior (milhares de clientes).
- Cada cliente tem seu próprio número/limite de mensagens na Meta (o limite
  sobe sozinho conforme a qualidade/uso daquele número aumenta) — não é um
  limite compartilhado entre os 100.
- O **nosso app** tem um limite de chamadas por hora que cresce junto com o
  app, mas precisa acompanhar o "quality rating" pra não tomar throttle.

**O risco real em 100 clientes não é a tecnologia, é a operação:**
- Guardar o token/acesso de cada cliente **isolado e criptografado** — um
  cliente não pode nunca conseguir acessar dado/token de outro.
- Monitoramento — saber quando a mensagem de algum cliente falhou.
- Suporte — alguém responder rápido quando um cliente tiver problema.

## 7. Custo estimado (resumo)

- Ferramentas de terceiro (tipo ManyChat pronto): **R$0** — vamos construir
  direto com a API da Meta, sem intermediário.
- Mensagens: cada cliente paga a própria conta na Meta — custo zero pra nós.
- Hospedagem: **US$7 a 25/mês** (≈ R$40 a R$140) pra sair do plano grátis do
  Render, cobre uma boa faixa inicial de clientes.
- Armazenamento de mídia (Cloudflare R2 ou similar): poucos centavos por
  GB/mês.

## 8. Fases sugeridas de execução (quando for começar)

1. Corrigir o armazenamento de mídia (sai do disco local, vai pra
   armazenamento permanente) — vale desde já, é base técnica compartilhada.
2. Criar um número de teste próprio na WhatsApp Cloud API (fora de produção),
   validar o fluxo de webhook + envio via API do zero, sem afetar Felizcred/
   Cota Certa/Massagem Vip.
3. Publicar política de privacidade e termos de uso (pré-requisito de
   qualquer App Review).
4. Rodar a Business Verification da empresa.
5. Implementar o Embedded Signup (fluxo de conexão do cliente).
6. Submeter as permissões pro App Review.
7. Só depois disso: montar o painel de automação/IA por cima (a parte visível
   tipo ManyChat).

## 9. O que NÃO fazer

- Não misturar isso com as contas/clientes que já usamos hoje (Felizcred,
  Cota Certa, Massagem Vip) — são consumidores da API, não a plataforma em si.
- Não tentar emular isso em cima do app comum de WhatsApp do celular — não
  tem API nenhuma ali, é fisicamente impossível automatizar múltiplos
  clientes assim.
