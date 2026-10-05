# Prompt para continuar a criação das campanhas Google Ads da Especitá

Copie tudo daqui para baixo e cole numa conversa nova do Claude Code aberta na pasta
`C:\Users\Salvador\Documents\meuwhatsapp`.

---

Leia primeiro `especita clinica/CLAUDE.md` inteiro. Depois leia
`especita clinica/plano-midia-2026-10/07-GOOGLE-ADS-ESTRUTURA.md` (doc gerado) e, se precisar
dos textos exatos, `07-GOOGLE-ADS.build.py` (gerador; `python 07-GOOGLE-ADS.build.py` regenera o doc e
os CSVs em `upload/`).

## Quem eu sou e como trabalho comigo

Sou o Salvador, não sou desenvolvedor, escrevo curto em português. Regras que valem nesta tarefa:

- Execute 100% sozinho, sem perguntar "quer que eu faça?". Só pare se for algo irreversível com
  dinheiro da cliente (ligar campanha, mudar orçamento). Tudo o que foi criado está PAUSADO e
  continua pausado: eu decido quando ligar.
- Ao terminar, atualize a seção "Google Ads — campanhas novas por produto" do
  `especita clinica/CLAUDE.md` com o que ficou feito/pendente, faça commit e push na branch main
  (só dos arquivos que você mexeu; há outra sessão trabalhando em `meta-ads-automation/` e
  `whatsapp especita/` ao mesmo tempo, não inclua os arquivos dela no commit).
- Nunca use dados, números ou credenciais de outros clientes (Felizcred, Ciahot, Cota Certa).

## Contexto da tarefa

Cliente: Especitá Odontologia e Estética, Dra. Catiucia (CRO-SC 14067, EPAO 4417), Rua Sete de
Setembro, 55, Sala 01, Santa Rita, Brusque-SC. Conta Google Ads 113-943-9321 (ocid na URL:
6477229172, `__c=4729027028`, `authuser=3`). Site real: https://clinicaespecita.com (WordPress de
uma página; já tem GTM-5W2C495R e tag AW-16475900720). WhatsApp da clínica: +55 47 99778-9519.

Pedido original: deixar as campanhas antigas como estão (`[pesquisa] 18/08 dentista` ativa e
`[pesquisa 28/07]` pausada) e criar em paralelo uma estrutura NOVA completa, uma campanha por
produto, com grupos, palavras, anúncios, públicos, decisão de contato (formulário x WhatsApp) e
plano de teste. Segmentação geográfica: SÓ a cidade de Brusque, sem raio e sem cidades vizinhas
(Botuverá/Guabiruba ficam longe; a cidade é "em vertical").

Regras do CFO (Res. 196/2019) aplicadas em todo texto: sem preço, parcelamento, "grátis",
promoção, garantia, superlativo, depoimento, antes/depois. Nome da Dra. + CRO-SC 14067 na
descrição 1 de cada anúncio (fixada na posição 1).

Decisão de contato: nenhum formulário (Google proíbe lead form para saúde). Todas as campanhas
mandam para o site (URL final = home, até existirem páginas por serviço) + recurso nativo de
mensagem/WhatsApp + recurso de chamada no horário da clínica.

## Navegador

Use o Claude in Chrome (ferramentas `mcp__claude-in-chrome__*`). Há DOIS Chromes conectados:
só o "Browser 1" está logado na conta Google Ads; se o primeiro `tabs_context` mostrar outro
perfil, use `list_connected_browsers` + `select_browser`/`switch_browser` para o Browser 1.
A aba do Google Ads estava com tabId 1346317510 (pode mudar). Frame de coordenadas da janela:
1568x726 (screenshot em escala 0.6 = 941x436; multiplique por 1/0.6 para clicar).

Truques que funcionaram (clicar por `ref` muitas vezes NÃO registra no Google Ads; clique por
coordenada ou use JS `.click()`):
- Upload em massa: Ferramentas > Ações em massa > Uploads. Google bloqueia por ~2 h se mandar
  muitas planilhas ("muitas solicitações"). Modelos oficiais com cabeçalho em inglês.
- Seletor de campanha nos editores (programação, públicos): caixa de busca, digite o nome,
  clique no resultado em ~(730,344); se não pegar, clique de novo.
- Listas suspensas que rolam a página: `[...document.querySelectorAll('[role=option]')].find(e=>e.innerText.trim()==='TEXTO').click()` via `javascript_tool`.
- Palavras bloqueadas pela política "Saúde em publicidade personalizada": só pela tela de
  Palavras-chave, marcando "Solicitar uma exceção" (clique por coordenada).

## O que JÁ está feito na conta (tudo PAUSADO)

1. 7 campanhas de Pesquisa criadas, nome `ESP - …`, Maximizar conversões, só Rede de Pesquisa,
   AI Max desligado, correspondência ampla desligada, recursos automáticos desligados, rotação
   "otimizar", idioma português, local Brusque (cidade), opção de local "Presença" (conferida nas
   7; a Ortodontia foi corrigida hoje): Urgência R$15/dia, Implante e Prótese 20, Ortodontia 10,
   Odontopediatria 8, Clareamento e Lentes 10, Harmonização Facial 10, Dentista em Brusque e
   Família 10.
2. 13 grupos de anúncios, 112 palavras-chave (57 via upload + 55 pela tela com pedido de exceção;
   várias ficam "em análise" por causa da política de saúde, é normal), 13 anúncios responsivos
   (15 títulos + 4 descrições, título 1 e descrição 1 fixados).
3. Listas de negativas criadas e aplicadas: "ESP - Negativas gerais" (49 termos, nas 7) e
   "ESP - Negativas de preço" (8 termos, em Implante + Harmonização).
4. Sitelinks no nível de campanha (6 por campanha = 42; os sitelinks antigos da CONTA dizem
   "Consulta Grátis", vedado pelo CFO, por isso os novos são no nível de campanha, que tem
   prioridade). Frases de destaque e snippet de serviços criados. Recurso de chamada
   "(47) 99778-9519" e recurso de mensagem/WhatsApp (beta) adicionados; status "em revisão".
5. Programação de anúncios salva nas 7 campanhas (42 linhas): seg–sex 07:00–21:00 e sáb
   07:00–13:00 (Urgência: seg–sex 07:00–20:00). Sem ajuste de lance por horário ainda.
6. Públicos em OBSERVAÇÃO (nível campanha) já salvos:
   - ESP - Odontopediatria: Pais de bebês (0–1), Pais de crianças pequenas (1–3), Pais de crianças
     em idade pré-escolar (4–5), Pais de crianças em idade escolar (6–12).
   - ESP - Ortodontia: Pais de adolescentes (13–17).
   Descoberta importante: NÃO existe segmento "serviços odontológicos" nem "procedimentos
   estéticos" (Google não oferece públicos de saúde) e "Eventos da vida" (casamento em breve,
   mudança recente) NÃO aparecem para campanhas de Pesquisa. Então use só Demografia detalhada,
   Afinidade e Em mercado.

## ONDE PAREI (estado exato da tela)

Na página Públicos-alvo (`/aw/audiences/summary`), o editor "Editar segmentos de público-alvo"
estava ABERTO para a campanha **ESP - Clareamento e Lentes**, modo Observação, com
"Planejamento de casamentos" (Em mercado) já marcado mas **NÃO salvo**, e a busca mostrando
resultados de "beleza". Se a aba ainda estiver assim: marque "Beleza e higiene pessoal"
(Em mercado), clique em Salvar (botão azul embaixo à esquerda, ~(353,700)) e confira que o editor
fechou. Se a aba recarregou e perdeu o estado, refaça do zero: botão "Editar segmentos de
público-alvo" > Campanha > buscar "Clareamento" > marcar os dois > Salvar.

## O que FALTA (nesta ordem)

1. **Públicos em observação** nas campanhas restantes, pelo mesmo fluxo:
   - ESP - Harmonização Facial: Em mercado "Planejamento de casamentos", "Beleza e higiene
     pessoal", "Maquiagem e cosméticos"; Afinidade "Entusiastas de beleza" se existir.
   - ESP - Clareamento e Lentes: (terminar, ver acima).
   - ESP - Dentista em Brusque e Família: Demografia detalhada "Pais" (todos os filhos; pode
     marcar todas as faixas) + Em mercado "Mudança/Serviços de mudança" se existir
     ("Eventos da vida: mudança recente" não está disponível em Pesquisa).
   - ESP - Implante e Prótese: nenhum público faz sentido (não existe segmento odontológico);
     deixe sem. ESP - Urgência: sem público (decisão de projeto).
2. **Conversões** (Metas > Conversões): confira o que existe. Deixe como PRIMÁRIAS só:
   clique no botão de WhatsApp do site (há `[Lead][Botão WPP]` com valor zerado e "Requer
   atenção", veja se dá para reaproveitar/consertar), ligação pelo recurso de chamada (≥ 30 s) e
   "Leads de mensagens" (do recurso de mensagem). `Lead Formulário`/`FORM SITE` e qualquer
   "rota/direções" ficam SECUNDÁRIAS. Não crie tag nova no site (o site é WordPress da cliente;
   anote o que precisaria ser feito no GTM-5W2C495R e inclua no relatório).
3. **Conferência final** campanha por campanha (Campanhas > ícone de engrenagem "Editar
   configurações" na linha): local = Brusque cidade + Presença; redes = só Pesquisa; parceiros
   de pesquisa desligados; AI Max desligado; programação personalizada; status pausado.
   Em Anúncios, conferir se os 13 anúncios estão "Qualificado" ou "Em análise" (não "Reprovado").
   Em Palavras-chave, listar quantas ainda estão "Em análise"/"Reprovado" e anotar.
4. **Ajustes de lance por horário** (opcional, deixei para o fim): Urgência +20% 11h–14h e
   17h–20h. Só se sobrar tempo; não é crítico.
5. **Atualizar `especita clinica/CLAUDE.md`** (a seção Google Ads ainda diz que faltam anúncios,
   palavras, sitelinks, chamada, programação; tudo isso já foi feito) e **commit + push**.
   Atenção: outra sessão editou o CLAUDE.md hoje e registrou que a pendência do TRF1/CRO-SC
   sobre harmonização foi RESOLVIDA (confirmado por mim). Então a campanha ESP - Harmonização
   Facial não precisa mais esperar o CRO-SC; continua pausada só porque tudo está pausado.
6. **Relatório final para mim**, curto e em português simples, com:
   - o que está pronto e como testar (plano de teste já está no doc 07: T1/T2 por campanha,
     14 dias, métrica = custo por conversa no WhatsApp; Ortodontia tem meta < R$30/conversa
     porque a Meta hoje paga R$40/lead);
   - o que eu preciso fazer/decidir: (a) publicar o site novo da pasta `especita clinica/site/`
     num subdomínio de clinicaespecita.com para trocar as URLs finais por páginas por serviço;
     (b) confirmar que o número +55 47 99778-9519 é o WhatsApp Business ligado ao recurso de
     mensagem; (c) consertar o rastreamento do botão de WhatsApp no WordPress (GTM); (d) decidir
     quando ligar e em que ordem (sugestão: Urgência + Implante primeiro, R$35/dia, 14 dias;
     depois Ortodontia e Família; Clareamento/Harmonização por último);
   - qualquer coisa que ficou "em análise" ou reprovada pelo Google.

## Como eu (a sessão anterior) penso sobre isso

- Prioridade é não gastar dinheiro da cliente por engano: tudo pausado, orçamento baixo, só
  Brusque, horário da clínica. Ligar é decisão do Salvador.
- Em Brusque o volume de busca é pequeno; por isso a estrutura é por produto (intenção), não por
  público. Público em observação serve só para coletar dado e, em 30 dias, virar ajuste de lance.
- Palavras em correspondência de frase e exata; nada de ampla; negativas de preço nas campanhas
  de ticket alto porque quem busca "quanto custa implante" quase nunca agenda e o anúncio não
  pode falar de preço.
- O anúncio diz onde a clínica fica ("em frente à ponte dos bombeiros", "Santa Rita") porque na
  cidade pequena a localização converte mais que promessa.
- Tudo que o Google marcar como "política de saúde" é esperado; pedir exceção, não reescrever.
- Se algo não funcionar por clique, tente coordenada, depois JS; não gaste mais de 3 tentativas
  no mesmo botão sem mudar de abordagem.
