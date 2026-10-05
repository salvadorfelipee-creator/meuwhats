# Diagnóstico de UX do painel para a Especitá — 04/10/2026

Versão escrita do relatório interativo (com mockups clicáveis "Hoje x Proposta"):
**https://claude.ai/artifact/YV89nyDHtF9K6STbH8Rikx**

Avaliado: `meuwhats.onrender.com/painel` (versão de 04/10/2026), navegando por todas as
abas como a recepção da clínica faria. Nenhum código foi alterado. Concorrentes
pesquisados: Squad, Kommo, Chatwoot, Respond.io, Umbler Talk, Blip Go, Zenvia, ManyChat,
HubSpot, Intercom e os softwares odontológicos Clinicorp, Simples Dental e Dental Office.

## Em 30 segundos

A base é boa (3 colunas, painel do contato com nota fixada/etapa/etiquetas/campos/retornos,
kanban, agendador de posts) e equivale ao que concorrentes cobram R$ 200 a 2.000/mês. O
problema é que, por fora, o painel ainda fala a língua da Felizcred e do programador.

| Gravidade | Achado |
|---|---|
| Crítico | Ainda é o painel da Felizcred: login "Painel Felizcred", canal "Felizcred (principal)", aba Funil de consignado CLT, etapas de empréstimo (Documentos enviados, Aprovado). |
| Crítico | Ninguém sabe o que precisa de resposta: lista sem contador de não lidas, sem tempo de espera, sem responsável; a prévia é quase sempre a mesma mensagem automática. |
| Crítico | Layout quebra abaixo de ~1100px (barra horizontal, painel do contato some para a direita). Não existe layout de celular. |
| Alto | Oito abas para três trabalhos: Funil, Pipeline e Analytics são o mesmo assunto; Email vazio; IA é tela de configuração de desenvolvedor; "Agenda" numa clínica significa consulta, não post. |
| Alto | Campanha exige colar "telefone,variável" por linha. Padrão de mercado: escolher segmento (etiqueta, etapa, "sem visita há 6 meses") e ver quantos vão receber. |
| Médio | Visual sem marca e pesado: tudo preto/branco/cinza, balões pretos, ícone de telefone vermelho (parece "desligar"), "delivered" em inglês, controles nativos ("Escolher arquivos"). |

**Não mudar:** 3 colunas, painel do contato, atalho "/" de respostas prontas, separação por
canal. Tudo bate com Chatwoot/Respond.io/Kommo. O redesign reorganiza e renomeia.

## Achados por tela

### Conversas (lista) — crítico
- Contatos como "5544991019277" com avatar "55". Nome primeiro, telefone formatado em 2º plano.
- Faltam filtros **Sem resposta / Minhas / Todas / Adiadas / Finalizadas**, contador de não lidas e tempo de espera (todos os concorrentes têm).
- Prévia de 14 das 20 linhas é a mesma mensagem automática do Instagram. Mostrar a última mensagem **do paciente**.
- Etiquetas e etapa não aparecem na lista.
- "Campanha" no topo de Conversas é envio em massa; nome e lugar confundem com post.

### Conversa aberta — crítico
- Em 800–1100px a 3ª coluna fica escondida com rolagem horizontal. Trocar de aba e voltar perde a conversa selecionada.
- Mensagens do robô e da atendente têm o mesmo balão preto.
- Sem indicação da janela de 24h do WhatsApp (quando só template funciona).
- Ações do cabeçalho são ícones sem rótulo. "Finalizar" não pede motivo.
- "delivered" em inglês; sem "visto"; sem quem respondeu.

### Detalhes do contato — alto
- Estrutura certa (melhor parte do painel).
- Etapas são de empréstimo. Clínica precisa: Novo contato → Avaliação agendada → Orçamento enviado → Em tratamento → Manutenção (+ Perdido).
- "Nenhum campo criado ainda" — deveria vir com Procedimento de interesse, Convênio, Dentista, Origem.
- "Configure o e-mail de backup" e "Reabrir fluxo automático" são de administrador e estão na ficha do paciente.
- Etapa em `select` nativo; etiquetas sem cor.

### Pipeline — alto
- Cartão com telefone cru e mensagem do robô. Faltam valor, próxima ação, responsável, tempo parado.
- 18 de 21 em "Sem etapa". Novo contato deveria cair em "Novo contato" automaticamente.
- Sem automação por etapa ("parado 3 dias → lembrete"), que Kommo/Umbler/Blip Go têm.
- Analytics repete o mesmo quadro.

### Agenda e Publicar — alto
- Renomear para **Marketing** (ou "Posts").
- Dias do calendário vazios; posts só na lista, sem texto/imagem; "16 com erro" sem onde clicar.
- Publicar e Agenda > Novo post são o mesmo formulário duplicado; chip de rede sem nome; "Escolher arquivos"; sem prévia.

### Campanha (envio em massa) — alto
- Pede telefones colados. Precisa de segmento + prévia do template + contagem + custo + limite diário + "agendar para".

### Funil, Analytics, Email, IA — médio
- Funil é 100% Felizcred (CLT).
- Analytics não mostra o que a dona quer: tempo até 1ª resposta, sem resposta agora, avaliações agendadas, comparecimento, origem do paciente.
- Email abre vazio com botão desabilitado sem explicação. IA é URL de conector. Ambos vão para Configurações.
- Login "Painel Felizcred"; telefone vermelho no rodapé é o seletor de canal.

## Concorrentes — padrões em 3+ ferramentas

| Padrão | Quem usa | No painel hoje |
|---|---|---|
| Filtros Minhas / Não atribuídas / Todas | Respond.io, Chatwoot, HubSpot, Intercom, ManyChat | não tem |
| Status Aberta / Pendente / Adiada / Resolvida (adiar = lembrete) | Chatwoot, Respond.io, Intercom, ManyChat | só Novo/Finalizada |
| Ícone do canal no avatar + contador | Respond.io, Chatwoot, Kommo, Zenvia | não tem |
| Tempo de espera visível | Intercom, Chatwoot, Zenvia, Blip, HubSpot | não tem |
| Atribuir a atendente | Kommo, Umbler, Respond.io, Chatwoot, Intercom, Zenvia, Blip | não tem (login único) |
| Notas internas destacadas | Chatwoot, Intercom, HubSpot, Respond.io, ManyChat, Kommo | tem (lateral) |
| Respostas rápidas com "/" | Chatwoot, Intercom, Zenvia, HubSpot, Kommo | tem, escondido |
| Fechar com motivo | Respond.io, Blip Desk, Zenvia | não tem |
| Kanban com cartão rico + automação por etapa | Kommo, Blip Go, Umbler, HubSpot, Simples Dental | cartão pobre |
| Campanha por segmento | Respond.io, Chatwoot, Umbler, Blip Go, Zenvia, Kommo, ManyChat | lista colada |
| Satisfação automática → avaliação Google | Chatwoot, Respond.io, Zenvia, Clinicorp, Simples Dental, Dental Office | não tem |
| Primeiros passos em 3–5 etapas | Kommo, Blip Go, Umbler, Simples Dental | não tem |

Preços (out/2026): Dental Office R$ 39–299; Clinicorp R$ 150–370; Simples Dental R$ 150–350;
Umbler R$ 99–220/atendente (mín. 2–3); Blip Go R$ 389; Respond.io US$ 79+; Kommo US$ 25–45/usuário;
Chatwoot US$ 0–39/agente; Zenvia R$ 600+ e setup R$ 649; Squad R$ 2.000–6.000.
**Faixa competitiva para a Especitá: R$ 200–350/mês total.**

Diferencial: nenhuma plataforma de inbox agenda posts/Reels (só a Squad, a R$ 2.000) e nenhum
software odontológico tem inbox real com CRM por conversa. Organizar o produto em
**Atendimento · Pacientes · Marketing**.

## Princípios do redesign
1. Fala de clínica (paciente, avaliação, orçamento, consulta, retorno). Nunca lead, template, canal, fluxo.
2. Primeiro o que está esperando. Espera com cor: verde até 5 min, âmbar até 30, vermelho depois.
3. Menu: Hoje · Conversas · Pacientes · Marketing · Relatórios · Configurações. Email e IA viram Configurações.
4. Cabe em qualquer tela: 3ª coluna vira gaveta < 1100px; celular com abas no rodapé.
5. Marca da clínica (logo, nome, verde-menta). Verde do WhatsApp e rosa do Instagram só como ícone de canal.

## Mockups (ver artifact)
1. **Hoje** — 4 números (sem resposta, consultas hoje, orçamentos parados, novos pacientes) + "precisam de resposta" + consultas do dia com estado da confirmação.
2. **Conversas** — filtros, nome do paciente, última mensagem dele em negrito, tempo colorido, canal no avatar, balão "Automático" tracejado, nota interna amarela, "Janela aberta · 23h restantes", atalhos visíveis, ficha com Interesse/Origem/Convênio/Responsável.
3. **Pacientes (pipeline)** — etapas de clínica, cartão com valor/próxima ação/responsável/tempo, soma por coluna, automação por coluna em uma frase.
4. **Marketing** — calendário com posts nos dias (cor por rede, erro clicável), formulário único com prévia estilo Instagram, área de arrastar imagem.
5. **Campanha em 3 passos** — quem recebe (6 segmentos, inclusive "sem consulta há 6 meses" e aniversariantes), prévia como no celular, contagem/custo/limite diário (250 até verificar a empresa na Meta).
6. **Primeiros passos / Configurações** — checklist de 6 etapas; Equipe (Dona / Recepção); horário; Integrações (Assistente Claude, backup).
7. **Celular** — abas no rodapé, lista em tela cheia, ficha em gaveta.

## Ferramentas novas (prioridade)

| Ferramenta | Impacto | Esforço | Fase |
|---|---|---|---|
| Confirmação de consulta (24h/2h antes, Sim/Remarcar) | muito alto | médio | 1 |
| Filtros + tempo de espera + responsável | muito alto | baixo–médio | 1 |
| Pacote de clínica: etapas, 4 campos, 12 respostas prontas, etiquetas | alto | baixo | 1 |
| Adiar conversa (snooze) | alto | baixo | 1 |
| Finalizar com motivo | alto | baixo | 1 |
| Campanha por segmento | alto | médio | 2 |
| Automação por etapa (3 regras prontas) | alto | médio | 2 |
| Satisfação + pedido de avaliação no Google | alto | médio | 2 |
| Relatórios de clínica | médio | médio | 2 |
| Origem automática pelo link do anúncio | médio | baixo | 2 |
| Agenda de consultas simples (só p/ confirmação e tela Hoje) | médio | médio–alto | 3 |
| Assistente de resposta com IA | médio | médio | 3 |
| Programa de indicação | baixo | baixo | 3 |

Atenção: o número da Especitá não tem empresa verificada → 250 conversas/dia. A tela de
campanha deve mostrar e bloquear acima do limite.

## Sistema visual
- Paleta: marca #0E7C6B, barra lateral #0F2A26, fundo #F4F7F6, marca suave #E3F3EF, atenção #B8690F, urgente #C03C3C, confirmado #2F7D4F, nota interna #FFF4CC.
- Tipografia: Bricolage Grotesque (títulos, números) + Instrument Sans (resto, 13–14px, números tabulares).
- Balões: paciente branco; robô cinza tracejado "Automático"; atendente verde suave com nome; nota amarela.
- Sombra só em janelas/menus; cartões com borda 1px; raio 8/12px; um botão principal por tela; ícones sempre com texto; estados em português; sem controles nativos.

## Plano em 3 fases
**Fase 1 (antes de entregar):** marca; menu novo; pacote de clínica; lista com nome/última msg do paciente/filtros/espera/contador; gaveta < 1100px; manter conversa ao trocar de aba; textos em português; balões; motivo ao finalizar.
**Fase 2 (1º mês):** equipe com papéis; adiar; janela 24h; confirmação de consulta; campanha em 3 passos; automações por etapa; calendário de marketing com prévia.
**Fase 3 (2º–3º mês):** satisfação → Google; relatórios de clínica; origem automática; celular completo; assistente IA.

### Checklist "nada da Felizcred" antes de entregar
- Título da aba e do login; nome do canal na barra lateral.
- Aba Funil (CLT) e etapas de empréstimo (ficha e pipeline).
- Mensagens automáticas padrão (menu do Instagram fala de consignado/FGTS/seguro).
- Links de Instagram/site nas mensagens fora de horário.
- Páginas de privacidade e termos com o nome da clínica (exigência Meta).
- Texto "Peça pro Claude fazer por você" na aba IA.
