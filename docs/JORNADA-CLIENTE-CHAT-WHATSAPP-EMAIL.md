# Jornada final do cliente — FelizCred

## Regra central

O chat do site é o canal de contratação. WhatsApp serve para entrada, autorização bancária e marcos importantes; e-mail registra a jornada e oferece retorno ao chat. Nenhum canal pede novamente um dado válido já coletado.

## Caminho normal

| Momento | WhatsApp | Chat do site | E-mail |
|---|---|---|---|
| Cliente chama | 1 resposta da FelizCred com uma pergunta e botão `Abrir chat seguro` | O link abre o chat automaticamente | — |
| Atendimento iniciado | — | Coleta progressiva, consulta e apresentação das condições | `Seu atendimento começou` |
| Autorização bancária | 1 mensagem enviada pela própria Facta | Explica o motivo da autorização e acompanha o retorno | — |
| Proposta criada | Sem mensagem adicional da FelizCred | Mostra revisão e assinatura no ambiente da Facta | `Sua proposta está pronta para revisão` |
| Assinatura recebida | 1 template Utility: proposta em análise | Mostra andamento sem pedir dados novamente | `Sua proposta está em análise` |
| Resultado final | 1 template Utility: concluída ou encerrada | Mostra status e próximo caminho | E-mail de conclusão ou encerramento |

Total normal: quatro mensagens visíveis no WhatsApp, contando a autorização enviada pela Facta. Teto: cinco, apenas se houver uma recuperação operacional indispensável.

## Mensagem de entrada

> Olá! Aqui é o Felipe, da FelizCred. Você quer simular ou acompanhar um empréstimo? Para manter tudo organizado e pedir somente os dados necessários, continue pelo nosso chat seguro.

Botão: `Abrir chat seguro`.

Não enviar menu, qualificação, lista de produtos ou lembrete automático no WhatsApp. A escolha do produto acontece no site.

## Templates que precisam de aprovação na Meta

O arquivo `templates/whatsapp/jornada-clt-meta.json` contém os três templates Utility, exemplos e variáveis de ambiente:

1. `felizcred_clt_proposta_em_analise`;
2. `felizcred_clt_proposta_concluida`;
3. `felizcred_clt_contrato_nao_finalizado`.

Os templates de análise e conclusão usam primeiro nome, código da proposta e banco. O template de contrato não finalizado usa primeiro nome e código da proposta. Nenhum contém CPF, valor, margem ou dados bancários.

## Templates que precisam ser cadastrados no Brevo

Os cinco HTMLs estão em `templates/brevo/`. São responsivos, usam CSS inline e parâmetros do Brevo. O cadastro no painel precisa preservar assuntos, remetente e parâmetros descritos no `README.md` da pasta.

## Regras de disparo

- Reavaliar a etapa antes de cada envio.
- Não enviar lembrete se o cliente já avançou.
- Não duplicar WhatsApp e e-mail para pedir a mesma ação, exceto proposta pronta para revisão: o e-mail registra as condições e o chat entrega o link.
- Cancelamento e conclusão são mutuamente exclusivos.
- Falha técnica não dispara mensagem de reprovação.
- Resposta do cliente no WhatsApp reabre uma janela de atendimento, mas o bot volta a indicar o chat em uma única mensagem.

## Métricas

- `whatsapp_entrada_recebida` → `chat_aberto`;
- `chat_aberto` → `conversa_criada`;
- `autorizacao_solicitada` → `autorizacao_confirmada`;
- `oferta_exibida` → `oferta_escolhida`;
- `proposta_criada` → `assinatura_concluida`;
- `assinatura_concluida` → `proposta_concluida`;
- entrega, leitura e clique por template de WhatsApp;
- entrega, abertura e clique por template do Brevo;
- parada por etapa e tempo até retomada.

## Dependências externas para finalizar

1. Aprovar os três templates no WhatsApp Manager.
2. Informar os nomes aprovados nas três variáveis `FACTA_SITE_WHATSAPP_*_TEMPLATE`.
3. Cadastrar os cinco HTMLs no Brevo e anotar os IDs gerados.
4. Confirmar remetente e domínio `felizcred.com.br` autenticados no Brevo.
