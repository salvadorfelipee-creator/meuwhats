# Frameworks internacionais: o que veio de fora e como usar

Esta pasta reúne 12 corpos de conhecimento pesquisados em fontes primárias (Harvard/HBR, a16z,
Reforge, Sean Ellis, Andrew Chen, Ehrenberg-Bass, OpenView/HubSpot, Paddle/ProfitWell, entre outros).
**Não leia os 12 arquivos por padrão.** Use a tabela de roteamento abaixo e abra só o que o
problema do cliente pede.

## As 6 leis que se repetem em todas as fontes

Quando qualquer framework internacional contradiz a intuição do cliente, volte para estas leis:

1. **Retenção decide o crescimento.** Aquisição sem retenção é balde furado: comprar tráfego para
   um produto que vaza cliente só acelera a perda de caixa. (Andrew Chen/a16z, Sean Ellis, Reforge)
2. **Canal satura.** Todo canal vencedor fica caro com o tempo — o CTR cai 10x ou 100x quando o
   mercado copia. Quem cresce tem *loop*, não apenas campanha.
   (Lei dos clickthroughs ruins, Andrew Chen; Growth Loops, Reforge)
3. **Loop vence funil.** Funil tem fim; loop se realimenta (indicação, conteúdo, comunidade,
   parceria, SEO, produto que gera mais uso). Escolha **um** loop principal e um apoio.
   (Reforge/Balfour)
4. **Crescimento vem de disponibilidade, não de lealdade.** Marca cresce por penetração e
   presença mental/física, alcançando também quem não está comprando agora (regra 95:5).
   (Ehrenberg-Bass/Byron Sharp)
5. **PMF antes de escala.** Escalar mídia antes do produto ser "must-have" multiplica o erro.
   O teste dos 40% é o filtro mais barato que existe. (Sean Ellis)
6. **A conta manda.** LTV/CAC, payback e margem de contribuição decidem o que escalar e o que
   cortar — não a opinião de quem gosta do canal. (a16z, Paddle, Reforge)

## Roteamento: problema do cliente, framework, arquivo

| Situação do cliente | Framework principal | Arquivo |
| --- | --- | --- |
| Não sabe por onde começar, não entende crescimento | Camada estratégica: Porter, Three Horizons, Value Stick | `internacional/01-harvard-estrategia.md` |
| Não sabe qual é a dor real do cliente / oferta não converte | Jobs To Be Done, quatro forças, ODI, CEP | `internacional/02-jobs-to-be-done.md` |
| Produto com uso fraco, churn alto, chute no marketing | Teste dos 40%, North Star Metric, ICE, sprints | `internacional/03-sean-ellis-pmf.md` |
| Cresce por campanha isolada e para quando desliga a mídia | Growth Loops, Four Fits, growth accounting | `internacional/04-reforge-growth-loops.md` |
| Quer conteúdo, recorrência, personalização e escala | Content + Algorithm + Scale, testes de preço | `internacional/05-netflix-caso.md` |
| Quer crescer com indicação/custo baixo | Loop viral, K-factor, indicação dois lados | `internacional/06-virais-dropbox-airbnb.md` |
| Retenção baixa, marketplace, efeito de rede, marketing caro | Cold Start, atomic network, curvas de retenção | `internacional/07-andrew-chen-a16z.md` |
| É pouco conhecido, depende de poucos clientes fiéis | Penetração, disponibilidade mental/física, CEPs, DBAs | `internacional/08-ehrenberg-bass.md` |
| Vende para empresas (B2B), ciclo longo, ticket alto | PLG, inbound flywheel, outbound, ABM, pipeline | `internacional/09-plg-b2b-saas.md` |
| Não sabe se o canal dá lucro | CAC, LTV, payback, coortes, ROAS vs ROI | `internacional/10-unit-economics.md` |
| Negócio local, atendimento por WhatsApp, cliente na região | STDC, ranking local, funil conversacional | `internacional/11-marketing-local-brasil.md` |
| Base grande e mal aproveitada, recompra baixa | Lifecycle, RFM, win-back, NPS, fidelidade | `internacional/12-retencao-lifecycle.md` |

## Como cada bloco entra no plano

| Bloco | Pergunta que responde | Onde entra no documento final |
| --- | --- | --- |
| Estratégia e oferta | Onde competir e por que ganharíamos? | Diagnóstico e posicionamento |
| Jobs To Be Done | Qual dor faz o cliente trocar de solução? | Persona, oferta, mensagem e criativos |
| PMF e North Star | O produto merece escala? Qual métrica manda? | Metas e indicador principal |
| Growth Loops | Como o crescimento se realimenta? | Motor de crescimento e canais escolhidos |
| Unit economics | O canal paga a conta? | Orçamento, metas de CAC e critérios de corte |
| Conteúdo e marca | Como ser lembrado e disponível? | Plano de conteúdo e mídia de alcance |
| Lifecycle e CRM | Como extrair mais da base atual? | Retenção, recompra e indicação |

## Cuidados ao importar referência de fora

- **Benchmark americano não é meta brasileira.** CPM, CAC e ticket médio mudam com câmbio,
  poder de compra e concorrência local. Use números de fora para *ordem de grandeza* e calibre
  com o baseline do próprio cliente.
- **Dado antigo é direcional.** Benchmarks de CPA de 2016–2018 (ex.: WordStream) servem para
  comparar canais entre si, não para prometer custo.
- **Caso de sucesso tem viés de sobrevivência.** Dropbox e Airbnb contaram a própria história;
  a mecânica do loop é confiável, o número não é auditado.
- **Grande empresa tem recurso que PME não tem.** Netflix pode testar preço com milhões de
  usuários; a PME deve testar com a própria base e aceitar menos significância estatística.
- **Fine print acadêmico importa.** Ehrenberg-Bass descreve padrões de categoria, não regras
  infalíveis; desvios existem e nichos têm regra própria.

## Como as fontes se completam (o meta-modelo)

O plano de captação ideal encadeia os blocos nesta ordem:

1. **Dor e job** (JTBD) → define oferta e mensagem.
2. **Merecimento** (PMF, retenção) → define se vale escalar.
3. **Motor** (loop principal + canais com melhor product-channel fit) → define onde investir.
4. **Conta** (CAC, LTV, payback, margem) → define quanto investir e quando cortar.
5. **Memória** (disponibilidade mental e física, conteúdo, marca) → define como continuar
   crescendo quando o canal principal saturar.
6. **Base** (lifecycle, CRM, indicação) → define quanto crescimento sai de graça.
7. **Ritmo** (sprints, ICE, teste semanal) → garante que o plano se corrige sozinho.

Sem o passo 1 não há conversão; sem o 2 não há escala; sem o 4 não há empresa; sem o 5 o
crescimento tem prazo de validade; sem o 7 o plano é um documento morto.