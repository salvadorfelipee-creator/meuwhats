# Governança de UTMs, eventos e conversões

Use esta referência ao criar ou auditar taxonomia, GTM, GA4, links de campanha, CRM e integrações offline. A regra é ter um vocabulário pequeno, versionado e capaz de chegar à venda.

## 1. Padrão UTM

Para links externos sem auto-tagging, exija `utm_source`, `utm_medium` e `utm_campaign`. Use minúsculas, sem acentos, hífens ou sinônimos. Reserve `utm_term` para termo e `utm_content` para peça/variante. Não marque links internos. Fonte: [Analytics Mania — UTM em GA4](https://www.analyticsmania.com/post/utm-parameters-in-google-analytics-4/).

| Campo | Regra | Exemplo válido | Exemplo inválido |
|---|---|---|---|
| `utm_source` | plataforma/origem fechada | `meta`, `newsletter`, `parceiro_x` | `Instagram`, `insta`, `ig` misturados |
| `utm_medium` | tipo de mídia | `paid_social`, `email`, `referral` | `social pago`, `Social` |
| `utm_campaign` | campanha estável e descritiva | `2026q4_black_friday_cadeiras` | `campanha nova` |
| `utm_content` | peça/variante | `video_dor_v2` | `criativo finalissimo` |
| `utm_term` | termo/palavra | `cadeira ergonomica` | preencher em toda campanha |

**Passos de governança:**
1. Publique a tabela de vocabulário permitido e um responsável por aprovar exceções.
2. Gere link por planilha/construtor e valide o destino, parâmetros e redirecionamentos.
3. Mantenha `campaign_id` da plataforma e `lead_id`/`order_id` como chaves separadas.
4. Faça amostragem semanal de 20 links `[hipótese operacional]`; rejeite qualquer maiúscula, espaço, acento ou source desconhecida.
5. Não combine UTM manual com auto-tagging sem declarar qual fonte prevalece.

## 2. Taxonomia GA4 em quatro camadas

| Ordem | Camada | Quando usar | Exemplos |
|---|---|---|---|
| 1 | Automáticos | já coletado pela implementação | `first_visit`, `session_start` |
| 2 | Enhanced Measurement | interação padrão habilitada e validada | `scroll`, `click`, `file_download` |
| 3 | Recomendados | ação de negócio com nome conhecido | `login`, `sign_up`, `generate_lead`, `purchase` |
| 4 | Customizados | não há evento adequado | `activation_complete`, `quote_approved` |

**Contrato mínimo:**

| Campo | Exemplo |
|---|---|
| Nome | `quote_approved` |
| Condição | backend confirma orçamento aceito |
| Parâmetros | `quote_id` (string), `value` (number), `currency` (string) |
| Key event | sim, se ligado a receita |
| Duplicidade | bloquear por `quote_id` |
| Fonte | backend/CRM, GA4 auxiliar |
| Dono | produto/CRM |
| Teste | aprovado em staging e produção controlada |

Em ecommerce, mantenha `items`, `item_id`, preço, quantidade, moeda e valor consistentes. Nunca envie nome, e-mail, telefone ou CPF em parâmetro livre.

## 3. Data layer e GTM

Exemplo de objeto conceitual (adapte à aplicação):

```json
{
  "event": "purchase",
  "transaction_id": "PED-12345",
  "value": 790.0,
  "currency": "BRL",
  "items": [{"item_id": "SKU-01", "quantity": 1, "price": 790.0}],
  "consent_state": "granted"
}
```

**Implementação segura:**
1. Defina o contrato com dev/CRM antes de abrir tags.
2. Faça o push no momento do fato confirmado, não na intenção do clique.
3. Use `transaction_id`/ID de negócio como deduplicador.
4. Configure tags, triggers e variáveis com nomes previsíveis e descrição.
5. Teste Consent Initialization antes de tags de analytics/ads.
6. Publique em workspace separado e registre versão, autor, data, mudança e rollback.
7. Compare GA4 com backend por dia e por ID; aceite divergência explicada, não igualdade forçada.

## 4. Conversões e key events

| Ação | Evento | Key event? | Fonte preferencial | Critério |
|---|---|---:|---|---|
| Formulário aberto | `form_start` | não | GA4 | diagnóstico de atrito |
| Lead confirmado | `generate_lead` | sim, se qualificado | CRM/GA4 | registro criado |
| Proposta enviada | `quote_sent` | não ou sim, conforme decisão | CRM | etapa de pipeline |
| Venda aprovada | `purchase`/`order_approved` | sim | ERP/CRM | pagamento/contrato confirmado |
| Cancelamento | `order_cancelled` | não | ERP | estorno/cancelamento |

Não compare conversão de plataforma, key event do GA4 e venda financeira sem tabela de definição. Cada uma responde a uma pergunta diferente.

## 5. Conversões offline e CRM

| Campo | Finalidade | Regra |
|---|---|---|
| `lead_id` | ligar captura à oportunidade | único e imutável |
| `campaign_id` | mapear origem na plataforma | guardar original |
| UTM snapshot | preservar origem da primeira/última interação | registrar regra escolhida |
| `order_id` | reconciliar receita | único, sem expor PII |
| `order_status` | separar aprovado, cancelado e estornado | usar estados fechados |
| `approved_at` | alinhar janela | timezone declarado |
| `margin_value` | medir economia | fórmula financeira documentada |

**Procedimento:** exporte vendas aprovadas; remova canceladas/duplicadas; valide IDs; aplique o mapeamento de origem; envie somente os campos permitidos pela plataforma; registre data, consentimento aplicável e resultado do upload; compare total por dia.

## 6. Auditoria de nomenclatura

| Checagem | Resultado esperado | Ação se falhar |
|---|---|---|
| nome em minúsculo | 100% conforme | corrigir taxonomia antes do dashboard |
| evento recomendado reaproveitado | sim quando disponível | abrir exceção documentada |
| parâmetro sensível ausente | nenhum PII aberto | bloquear publicação |
| origem no CRM | preenchida em ≥95% `[hipótese operacional]` | corrigir formulário/processo |
| compra deduplicada | 1 por `order_id` | pausar tag e reprocessar |
| versão do container | rastreável | publicar rollback documentado |

## 7. Fontes e limites

- [Eventos GA4](https://developers.google.com/analytics/devguides/collection/ga4/reference/events).
- [Consent Mode](https://developers.google.com/tag-platform/security/guides/consent).
- [Google Ads — atribuição e conversões](https://support.google.com/google-ads/answer/6394265?hl=en).
- O vocabulário deve ser adaptado à implementação; não há garantia de igualdade numérica entre ferramentas.
