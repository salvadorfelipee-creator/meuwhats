# Especitá Odontologia e Estética — contexto do projeto

Este arquivo é o ponto de partida de qualquer sessão Claude Code aberta neste projeto. Leia inteiro antes de agir. Este é um projeto **separado** de outros clientes (Felizcred, Ciahot, Cota Certa) — nunca reusar número de WhatsApp, WABA, Business Manager ou credenciais de outro cliente aqui.

## Quem é a cliente

- **Clínica:** Especitá Odontologia e Estética — nome correto confirmado em 2026-10-03 via Instagram oficial (@clinicaespecita). Documentos anteriores usaram "Específica" por engano — corrigir sempre que achar essa grafia antiga.
- **Dentista responsável:** Dra. Catiucia (nome registrado "Catiucia L. Riffel", também usa "Lanzzarin" nas redes) — CROSC 14067, EPAO 4417 (habilitação específica pra Harmonização Orofacial — diferencial real, não só marketing). Mais de 10 anos de atuação em Brusque/SC.
- **Endereço:** Rua Sete de Setembro, 55 — Sala 1, Santa Rita, Brusque/SC, 88352-000.
- **Instagram:** @clinicaespecita (2.181 seguidores em 03/10/2026). Bio confirma serviços: Odontologia geral, Harmonização Facial, Clareamento personalizado.
- **Site:** clinicaespecita.com.br — não resolveu (erro de DNS) na minha checagem de 03/10/2026; o usuário confirmou o cardápio de serviços por outro caminho. Vale testar o domínio de novo antes de apontar tráfego pago pra lá.

## Cardápio completo confirmado (direto do site, via usuário, 03/10/2026)

Urgência (dente quebrado, dor de dente), Implante dentário, Ortodontia (aparelho fixo + alinhador invisível), Atendimento infantil (odontopediatria), Tratamento odontológico geral (família), Harmonização facial, Avaliação clínica geral/check-up ("Dentista em Brusque"), Lente de contato dental, Clareamento dental personalizado, Bioestimulador de colágeno. Todos os 10 já estão cobertos nos 5 capítulos do artifact "Campanhas Especitá".
- **Google Ads Customer ID:** 113-943-9321
- **Conta de anúncios Meta:** 638556319545340 (nome do portfólio "Dra Catiucia Lanzzarin")
- **Página Facebook:** Específica Odontologia & Estética — ID 179575495920599
- **WhatsApp da clínica:** +55 47 9778-9519 — WABA ID 580089355818423, status "Conectado"/"Aprovada".
- **Business Manager:** "Dra Catiucia Lanzzarin" — business_id 381198169049625. **Verificação da empresa concluída em 05/10/2026** ("ESPECITA ODONTOLOGIA E ESTETICA LTDA", status Verificada) — limite de mensagem WhatsApp já deve estar em 2.000 conversas/24h, não mais 250.
- **Risco de acesso:** "HUGO PETYK" (hugopetyk@gmail.com) tem acesso total + financeiro no Business Manager dela, provavelmente da agência anterior — revisar/remover antes de qualquer migração.

## Próximo passo decidido (05/10/2026, sessão separada — projeto ainda estava dentro de `meuwhatsapp`)

Objetivo: criar campanhas Meta Ads **via API** (não manual pelo Gerenciador de Anúncios), pra poder
executar os playbooks já desenhados acima (ex: campanha "Noivos" de Harmonização Orofacial) de
forma automatizada/assistida por IA.

- Como o Business Manager já está **verificado** (ver acima), dá pra usar **Standard Access** —
  **não precisa de App Review do Meta**, que só é exigido pra Advanced Access (gerenciar conta de
  terceiros ou permissões sensíveis). Confirmar isso antes de seguir, caso as regras do Meta tenham
  mudado.
- Passo a passo: 1) criar app em developers.facebook.com tipo "Negócios", vinculado ao Business
  Portfolio "Dra Catiucia Lanzzarin" (business_id 381198169049625); 2) adicionar produto Marketing
  API; 3) criar Usuário do Sistema em Configurações do Business → Usuários → Usuários do sistema,
  função Admin; 4) atribuir a ele a conta de anúncios **991888939034732** (a que gasta de verdade —
  NÃO a 638556319545340, que só tem posts impulsionados quebrados) com permissão "Gerenciar
  campanha total"; 5) gerar token de Usuário do Sistema sem validade, escopos `ads_management`,
  `ads_read`, `business_management`.
- Antes de gerar o token, revisar/remover o acesso do "HUGO PETYK" (ver risco de acesso acima) —
  não faz sentido dar automação nova numa conta com acesso de agência anterior ainda ativo.
- Com o token em mãos, construir o script/integração que cria a campanha (começar pela de
  "Noivos", R$50/dia, já tem plano pronto na seção de Harmonização Orofacial acima) via Marketing
  API em vez de montar manualmente no Gerenciador de Anúncios.

## Como chegamos até aqui

Primeiro contato em 03/10/2026. Fizemos auditoria completa lendo direto as contas reais (Google Ads + Meta Ads Manager), sem estimativa. Achados completos em `especita clinica/google_ads_diagnostico_2026-10-03/` e `especita clinica/meta_ads_diagnostico_2026-10-03/` (CSVs + resumo em markdown). Resultado apresentado pra ela no artifact "Raio-X Específica".

## Decisão: o que manter e o que cortar

### Google Ads
- **Manter:** campanha ativa `[pesquisa] 18/08 dentista`, especialmente a keyword `"implantes dentarios"` — CPA R$10,50, ótimo resultado, CTR alto. É a base que já funciona.
- **Cortar:** manter pausada (não reativar) a campanha `[pesquisa 28/07]` — CPA R$265-309, qualidade ruim. Dentro da campanha ativa, pausar as keywords `"dentista brusque"` (índice de qualidade 3/10, já gastou R$927 por CPA R$309) e `dentista brusque sc` (índice 1/10).
- **Pendente antes de qualquer mudança de orçamento:** consertar o tracking de conversão — `Lead Formulário` e `[Lead][Botão WPP]` estão com valor zerado e status "Requer atenção"; `FORM SITE` fora das metas da conta. Não confiar no número de conversão mostrado até isso ser corrigido.
- Keywords com zero/pouco volume (`clinica odontológica`, `dentista infantil`, `odontopediatria`, `dor no dente`, `dentista perto de mim`) — reavaliar só depois do tracking corrigido.

### Meta Ads
- **Cortar:** pausar (não excluir de cara) as ~73 campanhas de "Impulsionar publicação" quebradas/com erro — não são campanhas estruturadas, são posts avulsos impulsionados.
- **Identificado em 05/10/2026 via Marketing API** (`especita clinica/meta-ads-automation/campaigns/listar-ativos.js`, consulta só leitura): o gasto real de R$44-71/dia é a campanha **"[leads] form"** (objetivo Geração de Leads, formulário instantâneo dentro do anúncio — não é WhatsApp) com 2 conjuntos ativos, `botox` R$25/dia e `ortodontia` R$25/dia, mais um post do Instagram impulsionado ("Sabia que trocar suas...") R$8/dia otimizado pra visita no perfil. Total ativo: **R$58/dia**. Todas as outras ~29 campanhas da conta estão pausadas (sem gasto). Manter essas duas rodando — já provam resultado (ver histórico de benchmark acima) — qualquer campanha nova (ex: Noivos via Marketing API) entra com orçamento **separado**, nunca substituindo isso sem um teste validado rodando em paralelo primeiro.
- Nunca desligar um canal que já traz paciente sem ter um substituto validado rodando em paralelo.

## Plano de A/B test

### Google Ads
- **Tipo:** teste de anúncio (RSA) dentro do grupo de anúncios já existente na campanha ativa.
- **O que testar:** Anúncio A = foco em "avaliação gratuita + implante"; Anúncio B = foco em "parcelamento facilitado".
- **Orçamento:** manter os R$65/dia já em uso — não aumentar até o tracking estar corrigido. O próprio Google faz a rotação entre as duas variações.
- **Duração:** 14 dias (tempo mínimo pra sair do período de aprendizado dado o volume de tráfego atual, ~20 cliques/dia).
- **Critério de decisão:** CPA real mais baixo, depois do tracking corrigido.

### Meta Ads
- **Tipo:** Teste A/B nativo do Gerenciador de Anúncios, variando **criativo** (não público — mantém o teste simples e barato).
- **Três testes propostos, um por produto, rodar um de cada vez começando pelo que já prova ROI no Google:**
  1. **Implante/Prótese** — Criativo A: antes/depois + CTA "avaliação grátis"; Criativo B: depoimento em vídeo + CTA direto pro WhatsApp.
  2. **Harmonização Orofacial (Botox)** — Criativo A: oferta de "vaga de paciente modelo" (ver seção de formatos abaixo); Criativo B: antes/depois tradicional, preço normal.
  3. **Odontopediatria** — Criativo A: foco na experiência tranquila da criança; Criativo B: foco nos pais (decisor de compra).
- **Orçamento sugerido:** R$30-40/dia por variante (R$60-80/dia por teste rodando as 2 variações).
- **Duração:** mínimo 7 dias, ideal 14 — Meta precisa sair da fase de aprendizado (~50 eventos de otimização por variante) pra o resultado ser confiável.
- Rodar com orçamento **separado** do que já está sendo gasto na campanha de manutenção — nunca tirar verba do que já funciona pra financiar o teste.

## Dois planos em paralelo

**Manutenção (não mexer até ter substituto validado):**
- Google: campanha ativa roda exatamente como está até o tracking ser corrigido.
- Meta: assim que a campanha que gera o gasto diário real for identificada, mantê-la rodando até a estrutura nova provar resultado melhor.

**Nova abordagem (em paralelo, orçamento à parte):**
- Construir estrutura de campanha de verdade no Meta (não impulsionar post) pros 3 produtos-chave.
- Rodar os testes A/B acima.
- Só migrar 100% do orçamento pra estrutura nova depois que ela provar resultado melhor que a atual.

## Formato de campanha por especialidade

**Implante / Prótese dentária (ticket alto):** ver skill `ads-odonto` — avaliação/simulação digital gratuita como isca, parcelamento como segundo gatilho, antes/depois, CTA direto pro WhatsApp. Métrica que importa: CPA por paciente fechado, não CPL isolado.

**Harmonização Orofacial — "Botox" feito por dentista:** o termo técnico correto no Brasil é **Harmonização Orofacial (HOF)**, não "Botox" isolado — é a nomenclatura que o Conselho Federal de Odontologia reconhece pra esse procedimento quando feito por cirurgião-dentista. Usar esse termo na comunicação oficial; "botox facial" funciona como palavra de busca popular, mas o posicionamento profissional é HOF.
- **Formato "paciente modelo":** inspirado no que clínicas de prótese capilar e estética fazem — abrir um número limitado de vagas (ex: 10) pra fazer o procedimento com uma condição especial de lançamento, em troca de registro de fotos/vídeo reais de antes e depois pra portfólio.
- **Atenção:** nunca anunciar como "de graça" ou "preço de custo" literal de forma enganosa — enquadrar como "condição especial de lançamento" ou "vaga de modelo com valor reduzido". Procedimento estético de saúde tem regras de publicidade do CFO (não pode prometer resultado, antes/depois tem regra específica de formato e consentimento) — revisar o texto final antes de publicar.

**Odontopediatria:** esse é o termo técnico correto da especialidade — "dentista infantil" é o termo popular de busca (bom pra palavra-chave), mas o nome profissional é Odontopediatria. Playbook completo com 4 campanhas (2026-10-03), detalhado no artifact "Campanhas Específica":
1. **Clube do Dente Corajoso** — pais de crianças 3-8 anos com medo/ansiedade; validado por literatura clínica (ansiedade dos pais se transfere pro filho). Oferta: Visita de Boas-Vindas sem procedimento.
2. **Primeiro Dentinho** — pais de primeira viagem, bebê 6-12 meses; validado com dado concreto (AAPD recomenda 1ª visita até 1 ano; visitar antes do 1º dente reduz até 95% risco de cárie até os 3 anos). Campanha always-on, sem sazonalidade.
3. **Acolhimento Sensorial** — pais de crianças neurodivergentes/sensibilidade sensorial. Público real e documentado, MAS precisa validação interna antes de lançar: confirmar se a clínica tem estrutura/treinamento pra atender bem esse público antes de anunciar.
4. **Passaporte do Sorriso** — não é anúncio pago, é retenção via WhatsApp (cartão de carimbo a cada revisão de 6 meses) pra quem já é paciente.
Bônus sem custo: pacientes adultas já cadastradas com filhos são a lista mais barata pra oferecer qualquer uma das 4 — contato direto por WhatsApp, sem mídia paga.

**Harmonização Orofacial — playbook completo (2026-10-03), 3 campanhas:**
1. **Noivos** — noivas e noivos, 6-12 meses antes do casamento, resultado discreto. Validado: tendência crescente real, inclusive entre homens.
2. **Harmonização Masculina** — homens 25-45. Validado com dado forte: homens já são 30% do mercado de estética no Brasil, 2º maior mercado de beleza masculina do mundo.
3. **Diagnóstico Facial Assistido** (público clássico 35-55) — entrada é diagnóstico profissional, não desconto; campanha separada por procedimento (preenchimento ≠ botox ≠ contorno).

**Prótese dentária — playbook completo (2026-10-03), 3 campanhas:**
1. **Hora de Trocar** — prótese/dentadura com 7+ anos sem reembasar. Validado: causa feridas, dificuldade de mastigar, risco de lesão pré-cancerígena; recomendação real é trocar a cada 5-7 anos.
2. **Perda Recente** — trauma/extração recente, urgência. Segmento intuitivo, SEM dado de pesquisa validando — tratar como hipótese a testar, não certeza.
3. **Nova Mordida** — 65+, desdentação múltipla/total, prótese total ou overdenture. Validado com dado concreto: estudo GOHAI mediu 38% de melhora na qualidade de vida com overdenture implantada.

**Clínica Geral — playbook completo (atualizado 2026-10-03), 5 campanhas (4º capítulo):**
1. **Urgência** (dente quebrado/dor) — maior intenção de compra de todas, prioridade é responder rápido.
2. **Ortodontia** — já rodou em 2026 (47 leads, R$40,30/lead, pior CPL do histórico) — recomendação: separar alinhador invisível (adulto) de aparelho fixo (adolescente/pais), meta é ficar abaixo de R$40,30.
3. **Lente de Contato Dental** — ticket alto, confirmado como produto real, não misturar com clareamento.
4. **Clareamento Personalizado** — benchmark real já existente: R$26,10/conversa (campanha de 2026).
5. **Primeira Avaliação** — anúncio guarda-chuva, orçamento baixo e constante, não é teste A/B.

## Histórico real de anúncios Meta 2026 (recebido do usuário 03/10/2026, conta 991888939034732, período jan-out/2026)

Antes de qualquer teste novo, comparar com esses benchmarks reais (não são estimativa de mercado, são a própria conta):
- `botox`: 112 leads, R$17,26/lead — melhor resultado da conta inteira. Status Ativo.
- `Clareamento`: 50 conversas, R$26,10/conversa. Desativada.
- `Protese protocolo 2`: 49 conversas, R$19,42/conversa. Desativada.
- `ortodontia`: 47 leads, R$40,30/lead — pior CPL. Aprendizado limitado.
- `botox` (2ª campanha): 45 conversas, R$19,70/conversa. Desativada.
- `DENTES BRANCOS 1`: 27 conversas, R$27,36/conversa. Desativada.
- `Protese Protoclo` / `PROTOCOLO`: 23 conversas cada, R$33,77 e R$20,51/conversa. "Protocolo" = provável referência a prótese protocolo tipo Brånemark/All-on-4.
- `COMECE O ANO`: 20 conversas, R$23,42/conversa — campanha sazonal de virada de ano, reaproveitar ideia na campanha de Avaliação Odontológica.
**Leitura importante:** quase tudo está "Campanha desativada" hoje, não porque não funcionou — funcionou bem — mas porque parou em algum momento, coerente com o problema de WhatsApp desconectado que achamos na auditoria (ver seção de risco de acesso acima). **Correção de posicionamento:** "Botox" como palavra crua já é o anúncio mais barato da conta — manter a palavra nos criativos, usar "Harmonização Orofacial" só como posicionamento institucional.

**Avaliação Odontológica — campanha de segmentação completa (2026-10-03), 5º capítulo, 5 públicos x 2 anúncios = 10 anúncios:**
Segmentação baseada no Censo da Odontologia CFO/ABIMO (fonte oficial) + gatilhos reais de agendamento, não inventada:
1. **Mulheres de renda/escolaridade mais alta** — maior segmento real do país (dado CFO: 80% de quem ganha 10+ salários mínimos vai regularmente ao dentista vs 59% de quem ganha até 1).
2. **Convênio odontológico empresarial** — 35-39% dos dentistas trabalham com convênio, benefício sub-aproveitado pelos próprios funcionários.
3. **Recém-chegados em Brusque** — mudança de cidade é gatilho real documentado; relevante pro polo têxtil local.
4. **Dor/desconforto represado** — gatilho mais citado, mas as pessoas adiam.
5. **Mais de 1 ano sem ir ao dentista** — ~32% dos brasileiros (o Censo diz 68% foram no último ano).
Essa campanha é a "rede de segurança": orçamento menor que as de especialidade, sempre ligada. Começar pelos públicos 01 (maior volume) e 04 (gatilho mais forte).

Todos os 5 capítulos (21 anúncios no total) estão no artifact "Campanhas Especitá" com persona detalhada, mockup de anúncio com foto real (banco gratuito Pexels) onde aplicável, público, fluxo e regras — cada persona marcada como validada por pesquisa ou precisando de teste, nunca inventada sem dizer.

## Como uma sessão nova deve agir aqui

1. Ler este arquivo inteiro antes de qualquer ação.
2. Nunca mudar orçamento, pausar ou criar campanha sem confirmar com o usuário (Salvador) primeiro — essas contas têm dinheiro real da cliente.
3. Antes de qualquer recomendação nova, confirmar se o tracking do Google já foi corrigido e se a campanha Meta que gasta de verdade já foi identificada — se não, isso é prioridade sobre qualquer outra tarefa.
4. Usar a skill `ads-odonto` (e as skills `ads-*`/`ads-audit`/`ads-google`/`ads-meta` instaladas) como base de conhecimento de growth marketing pro nicho odontológico/estético.
5. Qualquer página/relatório feito pra mostrar pra Dra. Catiucia: linguagem simples, nada de jargão técnico, tom direto e não muito formal.

## Plano de mídia para a reunião de 05/10/2026 (feito em 04/10/2026)

Pasta `especita clinica/plano-midia-2026-10/`: `00-RESUMO-REUNIAO.md` (roteiro de 45 min), `06-FLUXOS-WHATSAPP.html` (fluxos de conversa por produto, artifact https://claude.ai/artifact/UkATCgHQ9xiAdLYCnnjxep; editar via 06-FLUXOS-WHATSAPP.build.py),
`01-AUDITORIA-CAMPANHAS.md` (manter/alterar/pausar por campanha), `02-PUBLICOS-E-PERSONAS.md`
(um público por serviço), `03-PLANO-DE-TESTES.md`, `04-CRIATIVOS-E-CONTEUDO.md` (roteiros de
Reels e calendário), `05-CRONOGRAMA-E-MEDICAO.md`. Apresentação em slides:
https://claude.ai/artifact/NAXDX4xGzp5wy21EbCVL1c

Achados novos que entraram nesse plano (confirmar antes de agir):
- **Duas contas de anúncio na Meta**: 991888939034732 (a que gasta de verdade: botox R$ 25/dia +
  ortodontia R$ 25/dia = os R$ 44-71/dia que a auditoria não tinha identificado) e 638556319545340
  (74 posts impulsionados rejeitados, R$ 0). Concentrar tudo na primeira.
- **TRF1 (19/08/2026, harmonização orofacial) — resolvido.** A pendência de confirmar com o
  CRO-SC/advogado antes de anunciar harmonização/botox foi resolvida (confirmado pelo Salvador em
  05/10/2026). Não é mais um bloqueio — campanha nova de Harmonização Facial pode ser criada
  normalmente, só mantendo as regras de publicidade do CFO abaixo.
- **CFO (Res. 196/2019 + 271/2025)**: anúncio não pode ter preço, parcelamento, "grátis",
  promoção, garantia, depoimento; antes/depois só com TCLE e fora de anúncio pago. Nome + CRO sempre.
- **Meta 2025-2026**: exclusão por interesse acabou (só por público personalizado). Importante:
  **Advantage+ Audience, não só o detalhamento de interesse, trava a segmentação em conjuntos de
  Mensagens/Conversas** — a própria API recusa `age_min` acima de 25 se o Advantage+ Audience
  estiver ligado (erro real recebido ao criar conjunto, 05/10/2026). Pra idade/gênero valerem como
  restrição de verdade (não só sugestão), precisa mandar `targeting_automation: {advantage_audience: 0}`
  explicitamente — ver `meta-ads-automation/campaigns/criar-conjuntos.js`. Em Brusque (141 mil
  hab.), o criativo continua sendo o principal fator de segmentação.

## Conjuntos de anúncios por produto — criados em 05/10/2026 (via API, pausados)

A campanha "Noivos" (nicho de Harmonização Orofacial) foi descartada a pedido do Salvador — não
construir. Em vez disso, `meta-ads-automation/` ganhou um módulo reutilizável de Marketing API
(`lib/metaMarketingApi.js`) e um gerador por produto (`campaigns/produtos.js` +
`campaigns/criar-conjuntos.js`) que criou **7 campanhas novas / 11 conjuntos de anúncios novos**
na conta 991888939034732, todos com objetivo clique-direto-pro-WhatsApp (`OUTCOME_ENGAGEMENT` +
`destination_type: WHATSAPP`, não formulário), status **PAUSED**, horário seg-sex 7h-21h (precisa
de orçamento vitalício pra funcionar — dayparting não funciona com orçamento diário, ver
comentário no lib), público em Brusque + Botuverá + Nova Trento + São João Batista + Guabiruba,
R$20/dia de teste por conjunto (o script ajusta sozinho se o Meta recusar por orçamento mínimo).
Público por produto: combinação do plano local (`plano-midia-2026-10/02-PUBLICOS-E-PERSONAS.md`)
com pesquisa externa em agências brasileiras de marketing odontológico/estético (05/10/2026) —
fontes e raciocínio documentados nos comentários de `produtos.js`. **Não mexe em nada que já
roda** (botox/ortodontia formulário, post impulsionado — ver seção de campanha ativa acima).

Falta pra cada conjunto virar anúncio de verdade: **imagem** (Dra. Catiucia vai enviar depois —
copy de rascunho já está em `produtos.js`, campo `copyRascunho`, revisar com ela antes de publicar
por causa das regras do CFO) + rodar um script de criação de criativo/anúncio (ainda não escrito,
é o próximo passo depois que a imagem chegar — reaproveitar `uploadImage`/`createAdCreative`/
`createAd` de `lib/metaMarketingApi.js`, já tem tudo pronto, só falta o script por produto).

**Rastreamento — resolvido em 05/10/2026.** `whatsapp especita/server.js` + `db.js` agora captura
`msg.referral` de qualquer clique-pro-WhatsApp (qualquer número, não só Felizcred): grava atividade
detalhada na timeline da conversa + aplica tag de produto por palavra-chave no texto do criativo
(ver `registrarOrigemAnuncio`/`tagDoProdutoPorReferral` em server.js). Já commitado e no ar.

## App Meta publicado + 2 anúncios reaproveitando vídeo existente (05/10/2026)

**App "Especita" (developers.facebook.com) publicado.** Bloqueio encontrado: criar anúncio em
cima de post já existente (ver abaixo) exige app em modo público, não "em desenvolvimento" — e
publicar exige URL de Política de Privacidade preenchida, que não existia ainda pra Especitá.
Resolvido criando `public/privacidade.html` + `public/termos.html` no repo do painel (rotas
`/privacidade` e `/termos` do server.js já esperavam esses arquivos e nunca tinham sido
commitados — gap real, não só pendência documentada) e publicando via **GitHub Pages num
repositório novo e público, só com essas 2 páginas**: `github.com/especitaodonto/especita-paginas-publicas`
→ `https://especitaodonto.github.io/especita-paginas-publicas/privacidade.html` (e `/termos.html`).
Decisão importante: **não tornar o repo `Whatsappespecita` público** — ele tem o código-fonte
completo do produto que o Salvador vende pra outros clientes, só o conteúdo público da Especitá
foi isolado num repo à parte. Falta preencher CNPJ e e-mail de contato nos dois textos (marcado
como `[preencher]`).

**2 anúncios criados reaproveitando vídeo que já roda** (sem subir mídia nova): o vídeo do conjunto
"botox" (na real é sobre bioestimulador de colágeno, ver achado abaixo) foi usado no conjunto
"ESP - Harmonização Facial - geral", e o vídeo "ortodontia" (avaliação infantil) no conjunto
"ESP - Ortodontia - Aparelho fixo - pais" — ambos como anúncio novo PAUSADO, clique direto pro
WhatsApp (os originais continuam como estão, só formulário). Usa `createAdCreativeDeVideo` em
`lib/metaMarketingApi.js` (video_id + thumbnail já existentes, sem reupload) — ver
`campaigns/reaproveitar-videos.js`.

**Desempenho real dos 2 conjuntos ativos (insights de 90 dias, 05/10/2026) — pra decidir o que
aproveitar/melhorar:**
- `botox` (na real bioestimulador de colágeno): R$1.985 gastos, 117 leads a R$16,97, CTR 2,11%,
  frequência 4,32 (criativo cansado, confirma o plano). De 117 leads só 82 iniciaram conversa de
  WhatsApp — nem todo lead do formulário vira conversa.
- `ortodontia`: R$1.948 gastos, 48 leads a R$40,59 (pior CPL, bate com o benchmark já conhecido),
  CTR bem mais baixo (0,81% vs 2,11% do botox) — o vídeo/ângulo converte pior, não é só o produto.
- **Achado que contraria a suposição de horário seg-sex 7h-21h**: por hora do dia, o CPL do botox
  cai pra R$12,84 das 21h-24h (melhor janela do dia inteiro) contra R$19,36 na janela 7h-21h — as
  campanhas atuais rodam 24h e boa parte do resultado bom vem à noite. Pra ortodontia a diferença é
  pequena (R$41-47 em qualquer janela, amostra pequena). **Decisão pendente com o Salvador**: manter
  7h-21h nos conjuntos novos (compatível com capacidade de resposta da recepção) ou estender até
  23h/24h pra não deixar a janela mais barata de fora — é trade-off custo-por-lead x capacidade de
  atendimento fora do horário comercial, não uma correção óbvia.
- **Achado de nomenclatura**: o conjunto chamado "botox" não fala de botox — o vídeo e formulário
  são sobre bioestimulador de colágeno. Nome do conjunto ficou de campanha antiga; confirmar com a
  Dra. Catiucia se foi reposicionamento intencional ou anúncio esquecido com copy desatualizada.

## Site da clínica (construído 2026-10-05, ainda não publicado)

Pasta `especita clinica/site/` — site estático (HTML/CSS/JS puros) gerado por
`_build/build_site.py` a partir de `_build/content.py`. 16 páginas: home, 11 de serviço (uma por
produto, com SEO, JSON-LD, FAQ e ferramenta interativa ilustrativa), sobre, contato,
privacidade, termos; mais sitemap, robots, llms.txt e vercel.json. Ver `site/README.md` para
editar e `site/PROMPT-PARA-COLAR.md` para a conversa de publicação (domínio ainda não comprado;
publicar na Vercel como projeto próprio com Root Directory `especita clinica/site`, igual ao
felizcred-site). Pendentes que dependem do Salvador/clínica: domínio, fotos reais, CNPJ/e-mail,
formação da Dra., convênios, embed do mapa, GA4/Pixel, Search Console.

## Google Ads — LIGADAS em 05/10/2026 (ordem do Salvador)

**Atualização 06/10/2026:** Harmonização Facial também foi LIGADA (R$10/dia) a pedido do Salvador, com o anúncio novo sem botox. Total ativo = R$80/dia (7 campanhas ESP). Conferir nas próximas horas se o anúncio novo aparece "Qualificada" (não reprovado). Campanhas antigas `[pesquisa] 18/08`, `[pesquisa 28/07]` pausadas; GMN, `[SEARCH][LEAD][SITE]` e `Dentista em Brusque` (Smart) já estavam REMOVIDAS pela agência anterior (sem gasto nos últimos 30 dias). Ideia pendente: horário estendido até 23h nas campanhas não-urgentes, só se o WhatsApp tiver resposta automática fora do horário.

- **Ativas (6):** Urgência 15, Implante e Prótese 20, Ortodontia 10, Odontopediatria 8, Clareamento e Lentes 7 (baixado de 10), Dentista em Brusque e Família 10 = **R$70/dia** (teto pedido: R$80).
- **Pausadas:** `[pesquisa] 18/08 dentista` (antiga, R$65/dia, pausada para não competir) e `[pesquisa 28/07]`. Reativar a antiga se o teste de 14 dias for pior.
- **Harmonização reescrita (05/10, opção A do Salvador):** novo anúncio sem botox/bioestimulador (`upload/04c-harmonizacao-novo-anuncio.csv`, já subido no grupo "Harmonização e preenchimento"); grupo "Botox", anúncio antigo e palavra "bioestimulador de colágeno" PAUSADOS (remoção permanente foi bloqueada). Campanha segue pausada até o Google analisar o anúncio novo; falta decidir ligar. Palavra "preenchimento com ácido hialurônico" ainda ativa (risco incerto). Botox fica só no Meta (R$18/lead). O site não mostra o CRO da Dra.; incluir. Tom dos anúncios das outras 6: Salvador ainda não aprovou ajuste para linguagem mais informal.
- **Harmonização Facial NÃO foi ligada (motivo original):** Google reprovou o anúncio de Botox e limitou o de preenchimento ("termos relacionados a medicamentos restritos"). Precisa reescrever sem "botox"/"preenchimento" antes de ligar.
- Melhores termos da antiga copiados: "implante dentario perto de mim" (3 conv.) e "implantes dentários perto de mim" (2 conv., R$5,91) em ESP - Implante e Prótese > Implante dentário (frase, com pedido de exceção de saúde). Os demais já existiam nas novas.
- Contato: opção 1 (título leva ao site; botão de mensagem leva ao WhatsApp). Site ainda sem logo, será refeito.
- Meta (Facebook) fica para depois do Google; os 11 conjuntos novos seguem sem anúncio/imagem.

## Google Ads — campanhas novas por produto (atualizado 05/10/2026)

Arquivos: `especita clinica/plano-midia-2026-10/07-GOOGLE-ADS.build.py` (gerador) -> `07-GOOGLE-ADS-ESTRUTURA.md` + `upload/*.csv`.
Handoff de continuação: `plano-midia-2026-10/PROMPT-CONTINUAR-GOOGLE-ADS.md`.

**Feito na conta 113-943-9321 (tudo PAUSADO, Salvador decide quando ligar):**
- 7 campanhas `ESP - ...` (Urgência 15, Implante e Prótese 20, Ortodontia 10, Odontopediatria 8, Clareamento e Lentes 10,
  Harmonização Facial 10, Dentista em Brusque e Família 10 R$/dia). AI Max e ampla desligados, só Rede de Pesquisa,
  Maximizar conversões, local só Brusque (cidade, "Presença").
- 13 grupos, 112 palavras (57 por upload + 55 pela tela com pedido de exceção; várias "em análise" pela política de saúde),
  13 anúncios responsivos, listas de negativas (gerais nas 7; preço em Implante + Harmonização).
- Sitelinks no nível de campanha, frases de destaque, snippet, recurso de chamada e de mensagem/WhatsApp, programação (seg-sex 7-21h, sáb 7-13h; Urgência até 20h).
- Públicos em observação: Odontopediatria (4 faixas de pais), Ortodontia (pais de adolescentes), Clareamento e Lentes
  (casamentos + beleza e higiene pessoal), Harmonização Facial (casamentos + beleza + maquiagem e cosméticos), Dentista em
  Brusque e Família (só pais de crianças 6-12 anos, pedido do Salvador 05/10, + mudança e transferência). Implante e Urgência: sem público (decisão).
- Anúncios conferidos em 05/10: nenhum reprovado; ESP aparecem "Pendente" (normal enquanto pausadas).
- Harmonização: pendência do CRO-SC/TRF1 resolvida; só segue pausada junto com o resto.

**Pendente / decisão do Salvador:**
1. Conversões NÃO foram alteradas (mexer em primária/secundária é global e afeta a campanha antiga ativa `[pesquisa] 18/08`).
   Situação: `Lead Formulário` (419 conv., "Requer atenção"), `[Lead][Botão WPP]` (18, "Requer atenção"), `Calls from ads`,
   `Clicks to call`, `Local actions - Directions` (107) estão todas Principal; `FORM SITE` (36) está fora das metas.
   Não existe ação "Leads de mensagens". Sugestão: tornar Lead Formulário e Directions secundárias, consertar o botão de WhatsApp no GTM-5W2C495R.
2. Contagem de palavras "em análise"/reprovadas não conferida (tabela não carregou legível).
3. Ajuste de lance por horário (Urgência +20% 11-14h e 17-20h) não feito.
4. URLs finais = home https://clinicaespecita.com; trocar por páginas por serviço quando `site/` for publicado em subdomínio.
5. Confirmar que +55 47 99778-9519 é o WhatsApp Business ligado ao recurso de mensagem.
6. Ordem sugerida para ligar: Urgência + Implante (R$35/dia, 14 dias), depois Ortodontia e Família, Clareamento/Harmonização por último.
