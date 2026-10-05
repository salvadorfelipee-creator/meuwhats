# QA de dados, consentimento e reconciliação

Use antes e depois de publicar tags, campanhas, dashboards, integrações ou mudanças de checkout. QA é evidência reproduzível, não uma olhada rápida no gráfico.

## 1. Matriz de severidade

| Severidade | Exemplo | Regra de publicação | Dono padrão | Prazo de decisão |
|---|---|---|---|---|
| Crítica | compra duplicada, PII exposta, consentimento ignorado | bloquear publicação | analytics + jurídico/privacidade | no mesmo dia |
| Alta | conversão principal não chega ao CRM/financeiro | publicar só após correção ou aceite formal | analytics + dev | até 1 dia útil |
| Média | UTM inválida em uma campanha | corrigir antes da próxima leitura | mídia/CRM | até 3 dias |
| Baixa | rótulo ou formatação inconsistente | registrar backlog | BI | próxima sprint |

Os prazos são operação sugerida, não benchmark; ajuste ao risco e documente o acordo.

## 2. Casos de teste obrigatórios

| ID | Cenário | Passos | Evidência | Critério |
|---|---|---|---|---|
| QA-01 | entrada com UTM | abrir link, seguir redirecionamento, converter | URL, DebugView, CRM | origem/campanha preservadas |
| QA-02 | envio válido | preencher e confirmar formulário | request, evento, lead_id | 1 lead criado |
| QA-03 | clique sem envio | clicar e abandonar | rede/GA4 | não contar lead |
| QA-04 | reload/volta | recarregar confirmação e voltar | eventos + IDs | compra não duplica |
| QA-05 | SPA | navegar sem reload | data layer e rota | eventos nas rotas certas |
| QA-06 | cross-domain | entrar e pagar em domínios distintos | client/session IDs | jornada documentada |
| QA-07 | compra | concluir pedido aprovado | transaction_id, valor, moeda | 1 compra por ID |
| QA-08 | cancelamento | cancelar/estornar | ERP/CRM/GA4 | receita líquida atualizada |
| QA-09 | consentimento negado | recusar analytics/ads | tags, storage, pings | comportamento conforme política |
| QA-10 | consentimento aceito/revogado | alternar estados e repetir | CMP, tags, logs | estado respeitado |
| QA-11 | atraso | comparar D0 e D+1 | timestamps | frescor dentro do SLA declarado |
| QA-12 | divergência | comparar GA4, CRM e financeiro | tabela por dia/ID | causa explicada, não igualdade forçada |

## 3. Procedimento de execução

1. Congele versão, data, ambiente, navegador e conta testada.
2. Crie IDs de teste e marque o tráfego para não misturar com produção.
3. Execute o caminho feliz uma vez e cada exceção duas vezes `[hipótese operacional]`.
4. Capture URL, payload sem PII, console, DebugView/Realtime, CRM e pedido financeiro.
5. Conte duplicidades por `lead_id`, `transaction_id` e `order_id`.
6. Compare origem, valor, moeda, status, timestamp e consentimento.
7. Classifique severidade, abra ação com dono/prazo/critério e decida publicar, corrigir ou reverter.
8. Reexecute os casos afetados após a correção e arquive as evidências.

## 4. Reconciliação entre fontes

| Campo | GA4 | Plataforma | CRM | Financeiro | Regra de reconciliação |
|---|---|---|---|---|---|
| Sessão/clique | comportamento observado | entrega/atribuição própria | não aplicável | não aplicável | não somar |
| Lead | evento ou modelagem | formulário/conversão | registro operacional | não aplicável | CRM decide lead válido |
| Venda | `purchase` configurado | conversão atribuída | ganho | pedido aprovado | financeiro decide receita |
| Receita | valor informado | valor reportado | valor potencial/fechado | bruto, líquido e margem | declarar base |
| Cancelamento | pode atrasar | pode não refletir | status | estorno oficial | financeiro ajusta cohort |

Calcule divergência apenas depois de alinhar janela, timezone, filtros, moeda, status, consentimento, atraso e deduplicação. Não invente um percentual universal.

## 5. Consentimento e minimização

| Controle | Pergunta | Evidência | Dono |
|---|---|---|---|
| Finalidade | qual finalidade cada tag atende? | inventário de tags | privacidade/analytics |
| Estado | o que ocorre negado, aceito e revogado? | gravação do teste | analytics/dev |
| Minimização | qual campo é indispensável? | contrato de dados | BI/segurança |
| Retenção | por quanto tempo guardar? | política interna | jurídico/privacidade |
| Acesso | quem vê linha e dashboard? | permissões | TI/BI |
| Incidente | como bloquear/avisar? | runbook | responsável de dados |

Google documenta `ad_storage`, `analytics_storage`, `ad_user_data` e `ad_personalization` como sinais centrais do Consent Mode. Isso não substitui análise jurídica, CMP ou consentimento válido. Fonte: [Google Consent Mode](https://developers.google.com/tag-platform/security/guides/consent) e [guia ANPD sobre cookies](https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf).

## 6. Checklist de aceite

- [ ] tags críticas bloqueiam conforme estado de consentimento;
- [ ] nenhum PII está em URL, evento, parâmetro, dashboard aberto ou exportação;
- [ ] compra e lead são deduplicados;
- [ ] cancelamento e estorno têm fluxo;
- [ ] atraso e atualização têm SLA declarado;
- [ ] divergências têm definição e causa registrada;
- [ ] rollback foi testado;
- [ ] evidências estão arquivadas;
- [ ] cada falha tem dono, prazo e critério de reabertura.

## Exemplo de decisão

> **Achado:** 8 de 50 compras de teste duplicaram por reload `[medido no QA, amostra de teste]`. **Ação:** bloquear a tag e deduplicar por `transaction_id`. **Dono:** dev de checkout. **Prazo:** 1 dia útil. **Critério:** 0 duplicidade em 20 compras de teste e reconciliação de 7 dias; só então publicar.
