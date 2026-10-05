---
name: growth-marketing-agency
description: "Diagnóstico e plano de crescimento de um negócio — funil, oferta, motor, canais, metas, CAC e LTV em nível de plano e processo comercial. Use para plano de captação de clientes, plano de growth, estratégia de marketing da empresa, conseguir mais clientes e entender por que o negócio não cresce. Não use para executar mídia paga, escrever peças, produzir conteúdo de redes, montar medição, precificar seu próprio serviço ou operar a conta de um cliente já fechado — cada frente tem skill irmã própria."
---

# Agência de Growth e Captação de Clientes

Esta skill transforma um pedido curto ("quero um plano de captação para uma clínica odontológica")
em um plano de crescimento completo, com diagnóstico, oferta, canais, funil, conta do negócio,
cronograma e painel de controle — usando metodologia brasileira e frameworks internacionais
consolidados.

O conhecimento vem de três fontes, todas em `references/`:

| Fonte | O que contém | Arquivo |
| --- | --- | --- |
| Método do canal Staage (cursos completos de growth, marketing e IA) | método, alavancas de crescimento, matriz de canais, PPA, vendas | `references/metodo-staage.md` |
| Frameworks internacionais | Harvard, JTBD, PMF, growth loops, Netflix, Dropbox, Airbnb, Ehrenberg-Bass, PLG, unit economics, retenção | `references/frameworks-internacionais.md` + `references/internacional/*.md` |
| Operação prática | canais, segmentos, oferta/copy, vendas/CRM, métricas, ferramentas gratuitas, rituais | `references/canais-aquisicao.md`, `references/segmentos.md`, `references/oferta-e-copy.md`, `references/vendas-e-crm.md`, `references/metricas-benchmarks.md`, `references/ferramentas-gratuitas.md`, `references/ritual-de-growth.md` |

---

## Regras não negociáveis

1. **Diagnóstico antes de plano.** Nunca entregue canais e verba sem antes entender negócio,
   oferta, cliente, funil atual e capacidade. Se o usuário só deu o segmento, conduza o
   diagnóstico com perguntas curtas ou trabalhe com premissas **declaradas explicitamente**.
2. **Oferta antes de canal.** Canal ruim com oferta boa vence canal bom com oferta ruim.
   Se a oferta não estiver clara, essa é a primeira entrega.
3. **Números, não adjetivos.** Todo plano tem meta em número (clientes/mês, CAC, ticket, receita)
   e toda recomendação vem acompanhada do critério que decide se ela continua.
4. **Margem, nunca receita bruta.** LTV, ROAS e CAC se calculam sobre margem de contribuição.
5. **Premissa é premissa.** Separe no documento o que é **medido**, o que é **meta** e o que é
   **estimativa**. Nunca apresente estimativa como dado.
6. **Foco.** Máximo 3 canais na primeira fase: 1 motor principal + 1 de apoio + 1 em teste.
   Plano com 8 frentes é plano que não acontece.
7. **Ferramenta gratuita primeiro.** Prefira o stack de `references/ferramentas-gratuitas.md`;
   só recomende ferramenta paga quando o gratuito não resolver — e diga o custo.
8. **Nunca prometa resultado.** Entregue metas, faixas e critérios de decisão.

---

## Fluxo de trabalho

Siga as fases na ordem. Cada fase indica o que ler — leia **apenas o que a fase pede**
(divulgação progressiva: não carregue as 12 referências internacionais de uma vez).

### Fase 1 — Enquadrar o pedido

Identifique: empresa/segmento, cidade, objetivo (mais clientes, ticket maior, retenção, novo
canal), ticket médio, capacidade e orçamento. Se faltar informação essencial, faça no máximo
5 perguntas objetivas. Se o usuário quiser o plano agora, prossiga com premissas declaradas
numa seção "Premissas" no topo do documento.

**Leia:** `references/segmentos.md` (apenas o bloco do segmento do cliente).

### Fase 2 — Diagnóstico

Monte o diagnóstico nas quatro dimensões: negócio, oferta/preço, cliente/dor, funil/conversão.
Use `templates/diagnostico-empresa.md` como roteiro. Saída mínima:

- mapa do funil atual (volume e taxa por etapa) e os **três maiores vazamentos**;
- conta do negócio: ticket, margem, LTV, CAC atual e **teto de CAC** suportado;
- restrição principal (capacidade, caixa, oferta, reputação ou rastreio);
- hipótese central do plano.

Se o rastreio não existir (sem UTM, sem evento de conversão, sem CRM), o primeiro entregável
passa a ser **instrumentação**, não campanha.

**Leia:** `templates/diagnostico-empresa.md`, `references/metricas-benchmarks.md` (fórmulas).

### Fase 3 — Oferta e mensagem

Construa a oferta nas sete peças (dor, resultado, prazo, prova, redução de risco, preço,
próximo passo) e a mensagem com as palavras do cliente.

**Leia:** `references/oferta-e-copy.md`; `references/internacional/02-jobs-to-be-done.md`
quando a dor do cliente não estiver clara. Use `templates/roteiro-pesquisa-dor.md` para
especificar a pesquisa de dor quando fizer sentido recomendar entrevistas.

### Fase 4 — Motor, canais e funil

Escolha **um motor principal** (loop que se realimenta) e no máximo dois canais de apoio.
Justifique por que cada canal encaixa na intenção e na atenção do público daquele segmento.
Para cada canal, defina estratégia, estrutura, metas (volume, custo por lead, custo por venda),
prazo de leitura, critério de corte e riscos.

**Leia:** `references/canais-aquisicao.md`; `references/frameworks-internacionais.md` (roteamento);
`references/internacional/04-reforge-growth-loops.md` quando o cliente precisa de motor
recorrente; `references/internacional/08-ehrenberg-bass.md` quando o problema é ser desconhecido.

### Fase 5 — Conta do negócio (simulação)

Rode `scripts/calculadora_growth.py` com os números do cliente para gerar cenários conservador,
base e agressivo. O resultado entra no plano como metas e como critério de decisão.

```bash
python3 scripts/calculadora_growth.py --exemplo
python3 scripts/calculadora_growth.py --json entrada.json
```

Se preferir já sair com o documento montado, use `scripts/gerar_plano.py`: ele gera o plano em
Markdown com funil, unit economics, cenários, meta reversa e cronograma preenchidos, deixando
marcadores `[TODO]` apenas nas seções narrativas (diagnóstico, oferta, canais, riscos).

```bash
python3 scripts/gerar_plano.py --json cliente.json --out plano-captacao.md
```

O **teto de CAC** sai do negócio, não do mercado: `teto = margem mensal por cliente × meses de
retenção ÷ 3` (para LTV/CAC de 3x). Se um canal custa acima disso, ele é pausado ou ajustado.

**Quando o cliente não tem baseline** (o caso mais comum): não invente número como se fosse
medido e não deixe de fazer a conta. Derive o que der (CPL = gasto ÷ leads; conversão =
vendas ÷ leads — os campos `leads_mes` e `vendas_mes` existem para isso), marque como hipótese,
rode a meta reversa, defina a janela de 14 a 30 dias para medir de verdade e ancore a decisão no
teto de CAC, que é confiável porque sai da margem do próprio negócio. Para recorrência anual sem
tempo de permanência conhecido, use `meses ≈ 12 ÷ (1 − taxa de renovação anual)`.
Detalhes em `references/metricas-benchmarks.md`, seções 5 e 6.

**Leia:** `references/metricas-benchmarks.md`;
`references/internacional/10-unit-economics.md` para aprofundar.

### Fase 6 — Conversão, vendas e retenção

Nenhum plano de captação se sustenta sem tratar a metade que acontece depois do lead:
SLA de primeira resposta, roteiro de qualificação, régua de follow-up, registro de motivo de
perda e — tão importante quanto — recompra, reativação da base inativa e indicação estruturada.

**Leia:** `references/vendas-e-crm.md`, `references/oferta-e-copy.md` (scripts);
`references/internacional/12-retencao-lifecycle.md` para reativar base grande e parada;
`references/internacional/06-virais-dropbox-airbnb.md` para estruturar indicação.

### Fase 7 — Entregável, cronograma e controle

Monte o documento com `templates/plano-growth.md`. Inclua sempre: resumo executivo, diagnóstico,
oferta, motor e canais, contas e cenários, conversão/vendas, retenção/indicação, cronograma de
90 dias, painel semanal, riscos e rituais de decisão. Entregue os anexos operacionais
(`templates/painel-semanal.csv`, `templates/crm-pipeline.csv`) e o ritual em
`references/ritual-de-growth.md`.

Formato: Markdown. Se o usuário pedir apresentação, documento ou planilha, gere o arquivo
correspondente. Quando o documento passar de uma página, entregue o arquivo em vez de colar
todo o conteúdo no chat.

---

## Mapa de leitura por tipo de pedido

| Pedido do usuário | Comece por |
| --- | --- |
| "plano de captação para {segmento}" | `segmentos.md` + fluxo completo do SKILL.md |
| "por que não estou vendendo / não cresce" | `metricas-benchmarks.md` + `vendas-e-crm.md` |
| "onde investir em mídia / qual canal" | `canais-aquisicao.md` + `frameworks-internacionais.md` |
| "está caro adquirir cliente" | `internacional/10-unit-economics.md` + calculadora |
| "quero crescer sem verba" | `internacional/06-virais-dropbox-airbnb.md` + indicação |
| "melhorar retenção / recompra" | `internacional/12-retencao-lifecycle.md` |
| "montar time de vendas / CRM" | `vendas-e-crm.md` |
| "criar oferta / copy / anúncio" | `oferta-e-copy.md` |
| "usar IA e automação" | `metodo-staage.md` (bloco de IA) + `ferramentas-gratuitas.md` |
| "empresa B2B / SaaS" | `internacional/09-plg-b2b-saas.md` + `vendas-e-crm.md` |

---

## Estilo da entrega

- Português do Brasil, direto, sem jargão decorado e sem "consultorês".
- Cada recomendação tem dono, prazo e número. "Melhorar o Instagram" não é recomendação;
  "3 posts e 5 stories por semana com o tema X, medindo conversas iniciadas, dono: {pessoa},
  leitura em 30 dias" é.
- Explique o porquê em uma frase sempre que recomendar algo não óbvio.
- Diga o que **não** fazer neste ciclo — o que fica de fora é tão importante quanto o que entra.
- Se o plano depende de algo que o cliente não tem (verba, equipe, capacidade, rastreio),
  diga isso com clareza e ofereça a versão possível com o que ele tem hoje.

## Checklist antes de entregar

1. Existe meta em número e prazo?
2. A conta fecha em margem (LTV/CAC e payback calculados)?
3. A capacidade de atendimento suporta a demanda que o plano vai gerar?
4. Está claro quem executa cada frente na segunda-feira?
5. Cada canal tem critério de corte explícito?
6. Existe plano para o que acontece depois do lead (resposta, follow-up, registro)?
7. Existe plano para a base atual (recompra, reativação, indicação)?
8. As premissas estão declaradas e separadas dos dados medidos?
9. O painel tem no máximo 12 números e o documento cabe em 15 minutos de leitura?
10. O cliente consegue executar a primeira semana só com o que está escrito?

---

## Skills irmãs (agência completa)

Esta é a skill central: define o diagnóstico e o **motor** do crescimento. As irmãs executam
cada frente em profundidade — leia a que for acionada em vez de improvisar:

| Skill irmã | Quando entra |
| --- | --- |
| `copywriting-e-criativos` | quando o plano precisa de headline, oferta, roteiro, página de vendas, e-mail ou variações de anúncio |
| `trafego-pago` | quando o motor é mídia paga (Meta, Google Search/PMax, YouTube, TikTok, LinkedIn): estrutura, públicos, escala e corte |
| `seo-e-conteudo` | quando o motor é busca orgânica, SEO local, clusters de conteúdo ou busca com IA (GEO/AEO) |
| `social-media` | quando o motor é conteúdo orgânico, comunidade, UGC ou influenciadores |
| `dados-e-bi-de-marketing` | quando falta medição: GA4, UTMs, eventos, dashboards, atribuição, cohort e forecasting |
| `propostas-comerciais` | quando o crescimento é da própria agência/consultoria: diagnóstico, escopo, precificação e proposta |
| `gestao-de-clientes-de-marketing` | depois do "sim": onboarding, kickoff, rituais, SLA, relatório de resultados e renovação |

Regra de integração: o plano de captação escolhe o motor e define as metas; as skills irmãs
executam com o detalhe operacional. Não duplique o que a irmã faz melhor — cite a skill e o
arquivo que deve ser lido.
