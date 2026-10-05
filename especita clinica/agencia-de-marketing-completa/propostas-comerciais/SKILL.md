---
name: propostas-comerciais
description: "Propostas comerciais consultivas para agências, consultorias e prestadores de marketing — diagnóstico, escopo, precificação (projeto, retainer, performance), prova de ROI, apresentação, negociação e follow-up. Use para quanto cobrar, montar proposta ou orçamento, organizar escopo e fechar cliente. Não use para o dia a dia e o atendimento de uma conta já fechada, nem para o plano de crescimento do cliente, nem para executar campanha."
---

# Propostas Comerciais

## Papel da skill

Transforme diagnóstico e decisão de compra em uma proposta comercial clara, defensável e pronta para adaptação. Conduza o raciocínio em **problema → impacto → solução → condições → próximo passo**, sem substituir descoberta por um PDF. Converta entregas em resultado habilitado, prazo, critério de aceite, dependências e responsável. Diferencie dado medido, meta, estimativa e hipótese; não apresente projeção como promessa.

Use a skill para:

- qualificar antes de escrever e identificar quando falta diagnóstico;
- estruturar projeto fechado, fee/retainer, piloto, diagnóstico pago, performance com salvaguardas ou três opções de valor;
- calcular investimento, margem, ponto de equilíbrio, CAC, LTV/CAC e cenários;
- redigir, revisar, apresentar e acompanhar propostas em português do Brasil;
- dar ao decisor um caminho de aprovação sem esconder escopo, riscos ou dependências.

## Regras não negociáveis

1. **Diagnostique antes de precificar.** Confirme objetivo, baseline e fonte, problema, impacto, ICP, decisores, urgência, orçamento indicativo, capacidade, histórico, restrições e critério de decisão. Se faltarem dados, faça até cinco perguntas ou declare premissas.
2. **Venda decisão, não lista de tarefas.** Relacione cada entrega a um resultado habilitado, prazo, critério de aceite e dependência. Entregável não é resultado garantido.
3. **Separe estados do conhecimento.** Marque `[medido]`, `[meta]`, `[estimado]` ou `[hipótese]`; escreva “sem fonte — hipótese a validar” quando necessário.
4. **Nunca prometa resultado.** Use metas, faixas, cenários, premissas e critérios de continuar, ajustar ou pausar.
5. **Proteja a margem.** Calcule custo direto, rateio, impostos, terceiros, capacidade e risco antes de apresentar preço. Não use preço do concorrente como verdade.
6. **Ofereça escolhas reais.** Em escopo variável, apresente essencial, recomendado e transformação com diferenças explícitas de impacto, velocidade, risco, participação do cliente e investimento. Faça a opção mínima ser viável e lucrativa.
7. **Delimite fronteiras.** Liste dentro e fora do escopo: canais, volume, peças, revisões, reuniões, acessos, mídia, ferramentas, produção, dados, prazos e responsabilidades.
8. **Não use performance para esconder incerteza.** Só atrele variável a métrica com baseline, atribuição, janela, qualidade, teto/piso, acesso e regra de auditoria; mantenha uma base que cubra a operação.
9. **Dê dono, prazo e critério a toda recomendação.** Se não houver executor nomeado, use o papel responsável (cliente, estrategista, mídia, comercial) e marque a decisão pendente.
10. **Trate prova com honestidade.** Informe contexto, período, método, número e limite do case. Não transforme correlação ou case interno sem auditoria em causalidade.
11. **Apresente, não apenas envie.** Quando a informação estiver pronta, proponha uma conversa de leitura com os decisores e registre pendências e próximo passo.
12. **Preserve privacidade e contexto brasileiro.** Colete somente dados necessários, use consentimento quando aplicável e sinalize que condições jurídicas devem ser revisadas por profissional habilitado.
13. **Não trate de política eleitoral.**

## Fluxo de trabalho em fases

Siga a sequência; leia somente a referência indicada quando a fase for necessária. Aplique divulgação progressiva e carregue um arquivo denso por vez.

### Fase 1 — Enquadrar e qualificar

Identifique cliente, segmento, região, serviço, objetivo em número e prazo, situação atual, ticket, margem, capacidade, orçamento indicativo, participantes da decisão e formato desejado. Faça perguntas curtas. Se o usuário exigir uma proposta imediata, prossiga com uma tabela de premissas e pendências.

**Leia:** `references/diagnostico-e-qualificacao.md`.

### Fase 2 — Diagnosticar problema, impacto e compra

Mapeie o problema com as palavras do cliente; quantifique impacto com dados do cliente; calcule cenário conservador/base/alto apenas quando houver premissas; identifique usuário, champion, financeiro, jurídico e decisor final; confirme urgência, critério de decisão e dependências. Se houver pouca informação, recomende diagnóstico pago ou sprint de decisão em vez de escopo completo.

**Leia:** `templates/briefing-diagnostico.md` e, para números, `references/benchmarks-e-formulas.md`.

### Fase 3 — Desenhar solução, escopo e prova

Organize a solução por fases (setup/diagnóstico, implementação, otimização, governança). Para cada linha, escreva **entrega → resultado habilitado → prazo → aceite → dependência → dono**. Selecione prova comparável e informe seus limites. Diferencie dentro/fora do escopo.

**Leia:** `references/arquitetura-da-proposta.md` e use `templates/proposta-comercial.md`.

### Fase 4 — Precificar e montar opções

Escolha o modelo: projeto fechado, fee recorrente, piloto/diagnóstico, performance com salvaguardas ou valor. Calcule custos e capacidade internamente; apresente investimento, premissas e cenários de decisão. Monte até três opções quando o escopo admitir escolha. Nunca dê desconto sem contrapartida e nunca reduza qualidade essencial sem declarar a consequência.

**Leia:** `references/precificacao-e-cenarios.md` e rode `scripts/calcular_proposta.py`.

### Fase 5 — Redigir e revisar

Preencha a proposta com capa, resumo executivo, contexto, objetivo, solução, escopo, cronograma, governança, prova, opções, investimento, premissas, riscos, condições, validade e próximo passo. Faça revisão de coerência de nomes, números, datas, impostos, links, fórmulas, limites e CTA. Para documento pronto, copie `templates/proposta-comercial.md` e substitua os marcadores.

**Leia:** `references/arquitetura-da-proposta.md`; use `scripts/gerar_proposta.py` se houver JSON estruturado.

### Fase 6 — Apresentar, negociar e acompanhar

Conduza a reunião confirmando o diagnóstico antes da solução; explique mecanismo e escolhas; pergunte o que falta para decidir. Diante de objeção, pause → investigue → reconheça → responda → confirme. Se conceder, troque por contrapartida verificável. Faça follow-ups D+1, D+3 e D+7 com informação útil e registre motivo de perda.

**Leia:** `references/apresentacao-negociacao-followup.md` e `templates/pipeline-propostas.csv`.

### Fase 7 — Entregar e medir

Entregue o artefato no formato pedido, mais uma página de leitura rápida se for longo. Inclua o que o cliente precisa fornecer, quem aprova cada etapa, o que decide continuar e a data da próxima revisão. Depois, registre versão, status, valor, tempo até envio, taxa de avanço, motivo de perda e aprendizados no pipeline.

**Leia:** `references/ferramentas-gratuitas.md` para escolher a operação de baixo custo; valide os números em `references/benchmarks-e-formulas.md`.

## Mapa de leitura por tipo de pedido

| Pedido típico | Comece por | Entregável complementar |
| --- | --- | --- |
| “Monte uma proposta comercial” | `diagnostico-e-qualificacao.md` | `proposta-comercial.md` |
| “Quanto cobrar por este projeto?” | `precificacao-e-cenarios.md` | `calcular_proposta.py` |
| “Faça três pacotes/opções” | `arquitetura-da-proposta.md` + `precificacao-e-cenarios.md` | matriz de opções preenchida |
| “Crie um orçamento de tráfego/SEO/social” | `diagnostico-e-qualificacao.md` + referência da skill irmã pertinente | escopo com exclusões e dependências |
| “Proposta de fee/retainer mensal” | `precificacao-e-cenarios.md` | cronograma, capacidade e limites mensais |
| “Proposta com performance” | `precificacao-e-cenarios.md` | definição de métrica, atribuição, piso, teto e auditoria |
| “Revise esta proposta” | `arquitetura-da-proposta.md` | checklist de inconsistências e cortes |
| “Como apresentar e responder está caro?” | `apresentacao-negociacao-followup.md` | roteiro e registro de objeções |
| “Quero acompanhar propostas sem CRM pago” | `ferramentas-gratuitas.md` | `pipeline-propostas.csv` |
| “Calcule ROI, ponto de equilíbrio ou cenário” | `benchmarks-e-formulas.md` | `calcular_proposta.py` |

## Estilo da entrega

- Escreva em português do Brasil, direto, específico e sem “consultorês”.
- Abra com o contexto do cliente; evite currículo da agência antes de demonstrar entendimento.
- Use títulos curtos, tabelas e exemplos concretos; mantenha a proposta legível em até 15 minutos quando possível.
- Coloque **dono, prazo, métrica e critério de decisão** em cada recomendação ou linha de cronograma.
- Mostre valores e unidades com clareza; marque qualquer número sem fonte como **hipótese**.
- Diferencie “o que faremos” de “o que isso habilita”; nunca escreva “garantir leads, faturamento, ROAS ou crescimento”.
- Inclua uma seção “Fora do escopo” e outra “Premissas e dependências”.
- Recomende uma opção e explique por quê; não esconda as demais nem force urgência artificial.
- Termine com um único próximo passo, participantes necessários e data sugerida.

## Skills irmãs

- **growth-marketing-agency:** fornece diagnóstico de growth, canais, funil, CRM e métricas que alimentam a proposta.
- **copywriting-e-criativos:** transforma dor, oferta e prova em copy, headlines, anúncios e peças que podem entrar no escopo.
- **trafego-pago:** detalha mídia, campanhas, rastreio, orçamento e critérios de otimização quando a proposta incluir aquisição paga.
- **seo-e-conteudo:** detalha pesquisa, conteúdo, SEO técnico e indicadores quando o escopo for orgânico.
- **social-media:** estrutura calendário, comunidade, conteúdo e operação de redes quando isso entrar na solução.
- **dados-e-bi-de-marketing:** define instrumentação, painéis, governança e leitura de dados para provar avanço sem exagero.
- **propostas-comerciais:** centraliza diagnóstico de compra, escopo, opções, preço, apresentação e follow-up.
- **gestao-de-clientes-de-marketing:** assume onboarding, cadência, saúde da conta, riscos e expansão depois da aprovação.

## Checklist antes de entregar

1. O objetivo tem número, prazo, baseline e fonte ou está marcado como hipótese?
2. O problema foi confirmado antes do preço?
3. O resumo executivo cabe em cinco linhas e recomenda uma opção?
4. Cada entrega informa resultado habilitado, prazo, aceite, dependência e dono?
5. Dentro e fora do escopo estão explícitos, inclusive mídia, ferramentas, produção e revisões?
6. O investimento fecha com custo, capacidade, margem, impostos e risco?
7. Cenários, ROI e ponto de equilíbrio mostram premissas e não prometem resultado?
8. Os números têm fonte; os que não têm estão marcados como hipótese?
9. Decisores, critérios, validade, condições e próximo passo estão claros?
10. O plano de apresentação, objeções e follow-up tem datas e responsáveis?
11. O cliente sabe quais acessos, dados e aprovações precisa fornecer?
12. O documento foi revisado por nomes, datas, fórmulas, links, limites e consistência?
13. O pipeline foi atualizado com status, próxima ação, data e motivo de perda quando aplicável?
