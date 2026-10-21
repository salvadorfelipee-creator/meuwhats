---
name: advogado
description: "Metodologia para pesquisar jurisprudência/processos reais e redigir petições, usando sistemas públicos de tribunal (eProc, e-SAJ, PJe etc.) via navegador. Use quando o usuário pedir para 'pesquisar jurisprudência sobre X', 'ver processos parecidos', 'pesquisar um advogado/adversário', ou 'fazer uma petição' de qualquer assunto jurídico — não é específico do caso Facebook/WhatsApp, é o método geral. Cobre: como achar precedentes ganhos e perdidos, como achar o advogado da parte contrária, como estudar o estilo de escrita do advogado que vai assinar a peça, e como entregar o resultado (petição + memorando de pesquisa + fluxo resumido)."
---

# Metodologia de pesquisa jurídica e redação de petições

Esta skill não é sobre um assunto jurídico específico — é o **método** para
qualquer pesquisa de jurisprudência/processos que alimente uma petição,
validado numa sessão real (ação contra a Meta/Facebook por bloqueio de
WhatsApp Business, SC/SP, set/2026). Reaplique os mesmos passos pra qualquer
outro tema (trabalhista, consumidor, imobiliário, etc.) e qualquer outro
tribunal.

## Princípio central: só dado público, nunca contornar sigilo

Toda pesquisa é feita pelas ferramentas **públicas** de consulta processual
do próprio tribunal (Consulta Processual por nome/OAB/CPF-CNPJ), nunca
usando acesso privilegiado de terceiro nem tentando "habilitar-se" num
processo de quem não autorizou. Se um processo aparecer marcado **Segredo de
Justiça**, pular e seguir — nunca insistir ou tentar contornar. Isso vale
mesmo quando a sessão está logada com o OAB do próprio advogado do usuário:
usar o login dele só pra ver os processos dele mesmo (públicos), não como
atalho pra ver o que é sigiloso de terceiros.

## Passo 1 — Descobrir a base de pesquisa

Antes de pesquisar, identificar:
- **Qual(is) tribunal(is)/sistema(s)** cobrem o tema (ex.: TJSC usa eProc,
  TJSP usa e-SAJ, Justiça do Trabalho usa PJe — cada um com sua própria URL
  e fluxo de busca; se não souber, perguntar ou buscar "consulta processual
  pública [nome do tribunal]").
- **Quem são os advogados relevantes**: (a) advogados que já ganharam casos
  parecidos pro lado do cliente — servem de modelo de tese vencedora; (b) o
  advogado que representa a parte contrária nesse tipo de causa — muitas
  empresas grandes (bancos, plataformas, seguradoras) têm um advogado ou
  escritório "padrão" que aparece em centenas de processos no mesmo estado;
  descobrir quem é permite estudar as defesas que ele já tentou e onde elas
  falharam ou funcionaram.
- **Se o usuário já tem advogado definido**: guardar o nome/OAB dele desde
  já — vai precisar no Passo 4.

## Passo 2 — Buscar por OAB, não só por nome do processo

Na tela de "Consulta Processual", trocar o tipo de busca pra **OAB** (não
"Nome da Parte") e **sempre marcar "Exibir Baixados"** — sem isso, a busca
mostra só processos em andamento e esconde a maioria dos casos já julgados
(que é justamente o que interessa pra achar sentenças de mérito, ganhas ou
perdidas). Aumentar "resultados por página" pro máximo disponível (100 é
comum) pra não precisar navegar página por página.

⚠️ **Não confundir o painel "Relação de processos do advogado logado" (ex.:
"Painel do Advogado") com a Consulta Processual por OAB.** O primeiro filtra
por pendências/prazos abertos e pode mostrar uma fração pequena do histórico
real (numa sessão real, um mostrou 12 processos via painel contra 292 via
Consulta Processual por OAB — a mesma pessoa, só que a busca certa achou o
caso que realmente importava).

Se a lista vier muito grande pra ler uma por uma, usar busca de texto
(via qualquer método disponível — script, ctrl+F, ou a própria busca do
tribunal) pra filtrar linhas que contenham a palavra-chave do assunto
(nome da empresa ré, tipo de produto, etc.) antes de abrir qualquer
processo individualmente.

## Passo 3 — Para cada precedente relevante: abrir a sentença, não só a lista

A lista de resultados só mostra metadados (autor, réu, classe, situação). O
que importa está dentro do processo:
1. Abrir o processo e localizar o evento de sentença (geralmente nomeado
   `SENT1`, `INIC1` pra petição inicial, `DESPADEC1` pra despacho/decisão).
2. Ler o **dispositivo** (a parte final, "JULGO PROCEDENTE/IMPROCEDENTE/
   PARCIALMENTE PROCEDENTE") e a **fundamentação** que levou a esse
   resultado — não só o resultado em si.
3. Documentos em PDF costumam abrir num visualizador (Chrome nativo ou
   PDF.js) que **não expõe o texto via DOM/innerText** — nesses casos, usar
   screenshot e ler visualmente página por página (navegar pelas miniaturas
   ou pelo campo de número de página), em vez de insistir em scraping de
   texto que vai voltar vazio.
4. Anotar: número do processo, comarca/vara, autor, resultado, valores
   concedidos, e — o mais importante — **o motivo específico** pelo qual
   ganhou ou perdeu (não só "ganhou" ou "perdeu"). É a comparação entre um
   caso ganho e um caso perdido, com fatos parecidos, que revela qual prova
   ou argumento faz a diferença de verdade.

### O par ganho/perdido é o achado mais valioso

Sempre que possível, achar pelo menos um caso perdido (improcedente) além
dos ganhos. A leitura de "por que perdeu" costuma ser mais informativa que
qualquer caso ganho isoladamente — normalmente revela um requisito de prova
ou de procedimento que a petição em elaboração precisa cobrir
explicitamente para não repetir o erro.

### Achados processuais valem tanto quanto tese de mérito

Além da tese jurídica (que tende a se repetir e nunca mudar entre os
processos do mesmo tipo), prestar atenção a achados **processuais**: em qual
tipo de vara/rito a parte ré teve mais dificuldade de recorrer, se algum
recurso dela foi rejeitado por incabível, se algum processo travou por
problema de forma (ex.: procuração assinada por plataforma de assinatura
digital não credenciada pela ICP-Brasil). Esses achados mudam decisões
estratégicas concretas (em qual foro/rito ajuizar, como assinar a
procuração) que a tese de mérito sozinha não revela.

## Passo 4 — Estudar o estilo do advogado que vai assinar a peça

Se o usuário já tem advogado definido, **antes de inventar um formato
genérico**, tentar achar peças reais assinadas por ele:

1. Buscar pela OAB dele do mesmo jeito do Passo 2 (Consulta Processual,
   "Exibir Baixados" marcado) — sem se limitar a processos do mesmo assunto;
   o objetivo aqui é estilo de escrita, não jurisprudência.
2. **Verificar quem realmente assina**, não só quem está listado em "Partes
   e Representantes". Muitos advogados aparecem como associados/
   correspondentes num processo sem terem escrito a peça — abrir a última
   página do documento (bloco de assinatura) e confirmar que o nome dele
   está ali como signatário, não só cadastrado como procurador do processo.
3. Se o próprio usuário já foi cliente desse advogado antes (mesmo em causa
   totalmente diferente), esse é o melhor achado possível: buscar pelo CPF
   ou nome do usuário na lista de autores/réus que aparecem nos processos
   daquela OAB. Uma peça real, assinada por aquele advogado, pro mesmo
   cliente, é a referência de estilo mais confiável que existe.
4. Ler a petição inicial (evento 1) inteira e anotar o padrão: como ele
   endereça o juízo (fórmula exata, ex.: "AO JUÍZO DA X VARA..." vs.
   "EXCELENTÍSSIMO SENHOR..."), como numera as seções, como cita lei e
   jurisprudência (bloco, caixa alta, negrito/sublinhado em quê), quais
   frases de transição ele repete, e como fecha (fórmula final + como
   assina).
5. **Se não achar nenhuma peça que ele realmente assinou** (aconteceu nesta
   sessão — advogado tinha 292 processos, mas em todos os que a fundamentação
   foi aberta ele aparecia só como procurador associado, nunca como
   signatário), avisar o usuário com transparência em vez de fingir que
   existe um "estilo dele" e inventar um. Nesse caso, seguir o padrão mais
   forte encontrado nos precedentes vencedores do Passo 3 — é o que
   realmente convence o juízo daquela comarca, e o advogado assina como
   advogado de registro normalmente.

## Passo 5 — Escrever a petição

Montar a peça combinando: fatos do caso concreto (sempre perguntar ao
cliente o que falta — datas exatas, documentos, valores — nunca inventar
número que não há como provar), a tese de legitimidade/responsabilidade que
mais se repetiu vencendo no Passo 3, a fundamentação legal com as citações
formatadas do jeito achado no Passo 4, e os pedidos (incluindo tutela de
urgência, se cabível, com fumus boni iuris + periculum in mora).

Pontos de atenção recorrentes:
- **Nunca esconder fato que a parte contrária pode descobrir por conta
  própria** (ex.: outro número/canal que o cliente também usa, um documento
  que existe mas não favorece 100%). Contextualizar e preempt no texto em
  vez de omitir — parece mais forte pro juiz e evita ficar exposto na
  contestação.
- **Verificar políticas/regras da própria parte ré antes de alegar
  conformidade** (ex.: "sempre usei de acordo com as diretrizes" — checar se
  isso é realmente verdade nas políticas públicas da empresa, não só supor).
  Ir direto no domínio oficial da empresa; desconfiar de redirecionamentos
  pra domínios parecidos mas diferentes (ex.: `business.whatsapp.com`
  redirecionando pra `whatsappbusiness.com`, que não é da Meta) — sempre
  confirmar que o texto citado vem do domínio oficial de fato.
- **Escolha de foro/rito é decisão estratégica**, não só geográfica — usar
  qualquer achado processual do Passo 3 (ex.: um rito onde a parte ré tem
  mais dificuldade de recorrer de tutela) pra decidir.

## Passo 6 — Entregar em 3 formatos, cada um pra um uso diferente

Numa sessão real isso funcionou bem como conjunto de entregas separadas:

1. **A petição em si** (arquivo `.md` ou `.docx`, nunca publicada como link
   público — tem dado pessoal do cliente).
2. **Memorando de pesquisa em PDF**, caso a caso, com número de processo,
   resultado, resumo do motivo e link/número pra conferência — pensado pra
   o advogado cruzar a peça com a base de pesquisa e decidir se concorda.
3. **Fluxo resumido em uma página** (texto ou PDF com caixas/setas), só os
   tópicos da linha de raciocínio (fato → direito → estratégia → pedido),
   pra leitura rápida antes de entrar no memorando detalhado.

Gerar PDF localmente quando não houver pandoc/wkhtmltopdf disponível: a
biblioteca Python `fpdf2` (`pip install fpdf2`) funciona sem dependências
pesadas; usar fontes TrueType do sistema (`C:\Windows\Fonts\arial.ttf` e
`arialbd.ttf` no Windows) via `add_font` pra suportar acentuação em
português corretamente.

## Perguntas a fazer ao cliente antes de fechar a petição

Sempre que a narrativa do cliente tiver uma lacuna que pode virar problema
de prova depois (datas incertas, titularidade de linha/CNPJ dividida entre
pessoas, número que "seria bom" mas não tem como comprovar), perguntar
antes de escrever, marcando claramente o que ainda falta — nunca preencher
sozinho um dado factual que pode ser checado depois e desmentido.
