# Templates Brevo — jornada CLT FelizCred

Cadastrar como templates transacionais em `pt-BR`, remetente `FelizCred <contato@felizcred.com.br>`.

| Arquivo | Assunto | Gatilho | Parâmetros |
|---|---|---|---|
| `01-atendimento-iniciado.html` | Seu atendimento no chat da FelizCred começou | conversa criada | `NOME`, `CHAT_URL` |
| `02-proposta-para-revisao.html` | Sua proposta está pronta para revisão | proposta criada | `NOME`, `PROPOSTA`, `BANCO`, `CHAT_URL` |
| `03-proposta-em-analise.html` | Sua proposta está em análise | assinatura confirmada | `NOME`, `PROPOSTA`, `BANCO`, `CHAT_URL` |
| `04-proposta-concluida.html` | Sua proposta foi concluída | conclusão/pagamento | `NOME`, `PROPOSTA`, `BANCO`, `CHAT_URL` |
| `05-proposta-encerrada.html` | Seu contrato não foi finalizado | cancelamento/encerramento | `NOME`, `PROPOSTA`, `CHAT_URL` |

Valor padrão de `CHAT_URL`: `https://www.felizcred.com.br/?chat=abrir&utm_source=email&utm_medium=transacional`.

O envio atual já funciona pela API transacional do Brevo com HTML próprio. Os IDs criados no painel podem ser configurados depois caso a operação troque `htmlContent` por `templateId`.
