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
- **WhatsApp da clínica:** +55 47 9778-9519 — WABA ID 580089355818423, status "Conectado"/"Aprovada", **empresa ainda não verificada no Meta** (trava o limite de mensagem em 250 conversas/24h; verificando sobe pra 2.000)
- **Risco de acesso:** "HUGO PETYK" (hugopetyk@gmail.com) tem acesso total + financeiro no Business Manager dela, provavelmente da agência anterior — revisar/remover antes de qualquer migração.

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
- **Investigar antes de cortar:** existe cobrança real diária (R$44-71/dia, saldo R$650,14 em 03/10/2026) — uma campanha específica ainda não identificada está gerando esse gasto. **Primeiro passo de qualquer sessão nova: achar qual é essa campanha e decidir se mantém ou substitui.**
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
- **TRF1, 19/08/2026**: 8ª Turma considerou ilegal a Resolução CFO 198/2019 (harmonização
  orofacial como especialidade do dentista); CFO vai recorrer. Confirmar com CRO-SC/advogado antes
  de campanha nova de botox/preenchimento. A campanha atual segue.
- **CFO (Res. 196/2019 + 271/2025)**: anúncio não pode ter preço, parcelamento, "grátis",
  promoção, garantia, depoimento; antes/depois só com TCLE e fora de anúncio pago. Nome + CRO sempre.
- **Meta 2025-2026**: exclusão por interesse acabou (só por público personalizado); Advantage+
  detalhado forçado em campanhas de conversão/mensagem; localização e idade são as únicas
  restrições duras. Em Brusque (141 mil hab.), o criativo é o público.

## Site da clínica (construído 2026-10-05, ainda não publicado)

Pasta `especita clinica/site/` — site estático (HTML/CSS/JS puros) gerado por
`_build/build_site.py` a partir de `_build/content.py`. 16 páginas: home, 11 de serviço (uma por
produto, com SEO, JSON-LD, FAQ e ferramenta interativa ilustrativa), sobre, contato,
privacidade, termos; mais sitemap, robots, llms.txt e vercel.json. Ver `site/README.md` para
editar e `site/PROMPT-PARA-COLAR.md` para a conversa de publicação (domínio ainda não comprado;
publicar na Vercel como projeto próprio com Root Directory `especita clinica/site`, igual ao
felizcred-site). Pendentes que dependem do Salvador/clínica: domínio, fotos reais, CNPJ/e-mail,
formação da Dra., convênios, embed do mapa, GA4/Pixel, Search Console.
