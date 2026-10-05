# Testes e experimentos de copy e criativos

Use esta referência para transformar opinião em hipótese. **CTR, curtida e visualização são diagnósticos; a decisão final deve chegar à ação qualificada, venda, margem ou receita.**

## 1. Hipótese bem escrita

Formato:

> Acreditamos que **[mudança única]** vai alterar **[métrica primária]** de **[baseline]** para **[faixa/critério]**, sem piorar **[guarda]**, porque **[evidência]**. Dono: **[pessoa]**; janela: **[data]**; decisão: **[regra]**.

| Campo | Exemplo |
|---|---|
| Controle | anúncio “marketing completo” |
| Tratamento | “descubra onde o lead trava” |
| Variável | headline/ângulo |
| Primária | conversas qualificadas por R$ investido |
| Guarda | custo por conversa e taxa de qualificação |
| Evidência | 8 de 12 conversas mencionaram falta de rastreio |
| Janela | 14–30 dias ou ciclo completo; confirmar volume |
| Decisão | incorporar se primária superar controle sem piorar guarda |

## 2. O que mudar por rodada

| Teste | Mude | Mantenha | Quando escolher |
|---|---|---|---|
| Mensagem | hook/benefício/mecanismo | formato, público, destino | gargalo de relevância |
| Oferta | condição, escopo ou risco | mensagem e público | clique existe, ação não |
| Formato | UGC/estático/carrossel | mensagem e oferta | mensagem validada, atenção baixa |
| Destino | hero, formulário, CTA | anúncio e público | clique qualificado sem avanço |
| Operação | SLA/roteiro/follow-up | aquisição | lead chega, não agenda/fecha |

Não mude cinco variáveis e atribua o resultado a uma delas.

## 3. Métricas e fórmulas

| Métrica | Fórmula | Uso | Cuidado |
|---|---|---|---|
| CTR | cliques ÷ impressões | atenção/relevância | não prova venda |
| Taxa de conversa | conversas ÷ cliques | transição para contato | defina conversa qualificada |
| CPL | gasto ÷ leads | custo intermediário | lead barato pode ser ruim |
| Custo por qualificado | gasto ÷ qualificados | qualidade de aquisição | critério de qualificação antes |
| Conversão em venda | vendas ÷ leads/qualificados | eficácia do funil | declare denominador |
| CPA/CAC | gasto atribuível ÷ vendas/clientes novos | decisão de verba | incluir custos relevantes |
| ROAS | receita atribuída ÷ mídia | retorno de mídia | não considera margem |
| Margem por venda | preço − mídia − taxas − comissão − variáveis | teto econômico | confirme itens com financeiro |
| Taxa de retenção | clientes que permanecem ÷ base inicial | valor pós-venda | coorte e período |
| Receita por destinatário | receita atribuída ÷ destinatários | e-mail/CRM | atribuição precisa de regra |

## 4. Tamanho, janela e incerteza

A Meta recomenda, na documentação citada no dossiê, janela de 7 a 30 dias para seu A/B test e variável/hipótese mensurável; reconfirme na interface. A regra interna de 3–5 variações, 5–7 dias ou 30–50 cliques por variação é apenas **hipótese operacional**, não significância estatística. Em vendas de baixa frequência, espere o ciclo real e não force vencedor.

Antes de ler, registre:

- população exposta e sobreposição;
- orçamento e distribuição;
- conversões por variação;
- sazonalidade, mudanças de página/atendimento e atraso de atribuição;
- nível de confiança/método estatístico, quando houver volume para isso.

**Regra conservadora:** se houver pouca conversão ou diferença pequena, declare inconclusivo e decida entre estender, reformular hipótese ou arquivar. Não use curtidas como vitória.

## 5. Priorização ICE

Pontue 1–10:

- **Impacto:** potencial de mover a métrica primária.
- **Confiança:** força da evidência disponível.
- **Facilidade:** esforço e risco inversos.

`ICE = (impacto + confiança + facilidade) ÷ 3`.

| Teste | I | C | E | ICE | Dono | Prazo | Critério |
|---|---:|---:|---:|---:|---|---|---|
| Hook com sintoma | 8 | 7 | 9 | 8,0 | redator | 20/06 | qualificados por R$ ↑ sem CPL ↑ >20% |
| Novo motion | 5 | 4 | 5 | 4,7 | editor | 28/06 | retenção ↑ e CPA não piora |

Os números de ICE são pontuação de decisão, não benchmark de mercado. Empate: escolha menor esforço e maior aprendizado.

## 6. Leitura e decisão

| Resultado | Sinal | Decisão | Registro |
|---|---|---|---|
| Venceu | primária melhora e guarda não piora | incorporar, documentar controle e criar próximo teste | efeito, contexto, data |
| Perdeu | primária piora ou guarda rompe | reverter e explicar o aprendizado | não apagar peça |
| Inconclusivo | volume insuficiente/ruído | estender ou arquivar com motivo | próxima pergunta |
| Risco | claim, tracking ou operação inválidos | interromper, corrigir e só depois interpretar | responsável e aprovação |

Escalar é uma decisão gradual: primeiro repita o resultado em nova janela/coorte, depois aumente distribuição. Não trate média externa como garantia.

## 7. Instrumentação mínima

1. Nomeie a variante (`canal_formato_angulo_data`), registre UTM e destino.
2. Capture impressão/clique, evento de lead, qualificação, agendamento, venda, margem e motivo de perda.
3. Faça o CRM guardar origem e próxima ação.
4. Suprima compradores de ofertas inadequadas em sequências.
5. Feche o ciclo com feedback de vendas e suporte.

Use `templates/log-experimentos.csv` e `scripts/calculadora-copy.py` para reduzir erro de conta. Fonte principal de janela A/B: Meta, https://www.facebook.com/business/help/290009911394576; limite de variantes criativas e interface: https://www.facebook.com/business/help/1423851372208214.
