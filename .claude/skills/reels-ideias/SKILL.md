---
name: reels-ideias
description: >
  Gera 3-5 ideias de Reels do Instagram pra Felizcred a partir de um reel de referência
  colado (link, descrição ou transcrição) ou de um tema solto. Use sempre que o usuário disser
  "ideia de reel", "ideias pra Instagram", "preciso de tema de vídeo", "reel sobre [produto]"
  ou colar um vídeo/reel de outra conta como referência. Primeiro passo do sistema de
  produção de Reels da Felizcred — a saída alimenta a skill reels-copywriter.
---

# Reels — Gerador de Ideias

## CRITICAL: ao carregar

Vá direto pro Passo 1. Não resuma a skill, não explique como funciona.

## Limite honesto (leia antes de prometer algo ao usuário)

Esta skill **não tem acesso a um scraper confiável de Instagram de terceiros**. A API do
Instagram configurada neste projeto só lê a própria conta da Felizcred (ver `instagram.js`),
não a de concorrentes ou referências. Então esta skill trabalha a partir do que o **usuário
cola** (link, descrição, print ou transcrição de um reel que viu), não de descoberta
automática de contas virais. Se o usuário pedir "vasculha o Instagram e acha ideias
sozinho", explique essa limitação em vez de fingir que rodou uma busca.

## Passo 1. Entender a entrada

Leia `../_felizcred-reels-voz.md` primeiro (produtos reais, público, tom).

Se o usuário já colou um reel de referência (link, texto, transcrição) ou já disse um tema,
use isso e pule pro Passo 2.

Senão, pergunte com AskUserQuestion:

```json
[
  {
    "question": "De onde vem a ideia?",
    "header": "Entrada",
    "multiSelect": false,
    "options": [
      {"label": "Tenho um reel de referência", "description": "Vou colar o link, a transcrição ou descrever o vídeo que vi"},
      {"label": "Tenho um tema/produto em mente", "description": "Ex.: seguro de carro, FGTS, garantia"},
      {"label": "Sugira você", "description": "A partir dos 5 produtos da Felizcred, sugira temas variados"}
    ]
  }
]
```

Se "Tenho um reel de referência": peça pra colar (link/transcrição/descrição) e espere.
Se "Tenho um tema": peça o tema e espere.
Se "Sugira você": pule direto pro Passo 2 usando os 5 produtos do `_felizcred-reels-voz.md`
como ponto de partida, um tema por produto.

## Passo 2. Gerar 3 a 5 ideias

Cada ideia tem:

- **Título curto** (o que o vídeo é, 1 linha)
- **Produto real** que ancora a ideia (dos 5 do `_felizcred-reels-voz.md` — nunca inventar
  um produto que a Felizcred não oferece)
- **Ângulo**: por que essa ideia prende atenção — qual dúvida real, medo ou confusão do
  público ela resolve (ex.: "muita gente não sabe que pode usar o carro como garantia sem
  perder o uso dele")
- **Por que funciona**: 1 frase citando o padrão do reel de referência (se houver) ou o
  motivo comportamental (curiosidade, medo de perder dinheiro, comparação antes/depois)

Se veio de um reel de referência, a primeira ideia deve **adaptar o mesmo padrão/estrutura**
pro produto da Felizcred (não copiar o conteúdo, copiar o mecanismo — ex.: se o reel de
referência é "3 erros que fazem você perder dinheiro", a ideia vira "3 erros que fazem você
perder o FGTS parado").

## Passo 3. Formato de saída

```
IDEIAS DE REELS

1. [Título]
   Produto: [produto real]
   Ângulo: [por que prende atenção]
   Por que funciona: [motivo]

2. ...
```

Depois pergunte: "Qual dessas quer que eu transforme em roteiro? Chame a skill
reels-copywriter com o número."

## Regras

- Nunca inventar dado financeiro (taxa, prazo, valor) — isso é papel da reels-copywriter e
  do `_felizcred-reels-voz.md`, aqui é só a ideia/ângulo.
- Nunca prometer que rodou uma busca ou scraping que não existe.
- Sempre ancorar em um dos 5 produtos reais, nunca um produto genérico "empréstimo" solto.
- Se o usuário colar um reel de referência de um nicho totalmente diferente (ex.: moda,
  humor), adapte o mecanismo/estrutura, não o conteúdo literal.
