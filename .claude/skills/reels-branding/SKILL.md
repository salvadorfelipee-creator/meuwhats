---
name: reels-branding
description: >
  Checklist de consistência do perfil do Instagram da Felizcred (bio, destaques, grid) e
  naming de séries de Reels. Use quando o usuário disser "audita meu perfil", "revisa a bio",
  "nome pra série de reels", "brand kit" ou "meu Instagram tá bagunçado". Quinto passo,
  mais opcional, do sistema de produção de Reels da Felizcred.
---

# Reels — Branding e Auditoria de Perfil

## CRITICAL: ao carregar

Vá direto pro Passo 1.

## Passo 1. O que o usuário precisa

Pergunte com AskUserQuestion se não estiver claro:

```json
[
  {
    "question": "O que você quer revisar agora?",
    "header": "Foco",
    "multiSelect": false,
    "options": [
      {"label": "Auditoria do perfil", "description": "Bio, destaques, primeira impressão de quem chega no perfil"},
      {"label": "Nome pra série de Reels", "description": "Ex.: um nome fixo pra série sobre um dos 5 produtos"},
      {"label": "Peça visual (capa de destaque etc.)", "description": "Chama o graphic-designer global pra gerar o prompt/HTML"}
    ]
  }
]
```

## Passo 2a. Auditoria de perfil

Peça a bio atual (texto) e a lista de destaques (nomes). Leia `../_felizcred-reels-voz.md`
pra saber os 5 produtos e o tom. Avalie:

- A bio deixa claro em 1 leitura o que a Felizcred faz e pra quem?
- Tem um caminho claro pro WhatsApp (link ou instrução)?
- Os destaques cobrem os 5 produtos, ou faltam alguns?
- Algum destaque desatualizado ou confuso?

Devolva uma lista curta de ajustes concretos (reescreva a bio se estiver ruim, sugira nomes
de destaque faltando), não uma redação genérica de "boas práticas de Instagram".

## Passo 2b. Naming de série

Uma série de Reels precisa de um nome curto e repetível (aparece toda vez, vira reconhecível)
— ex. um nome pra série que sempre responde dúvida de um produto específico. Proponha 3
opções, cada uma com 1 frase de por que funciona, ancoradas nos produtos reais da Felizcred,
não em termos genéricos de "finanças".

## Passo 2c. Peça visual

Para qualquer peça gráfica (capa de destaque, carrossel, etc.), não reinvente — chame a
skill global `graphic-designer` (já instalada) e informe que o assunto é Felizcred, usando os
assets existentes em `felizcred-site/logo/` como referência visual/paleta se disponíveis.

## Regras

- Não sugerir mudança de nome de usuário/handle sem o usuário pedir explicitamente (mexe em
  link, ads, tudo que já aponta pro perfil atual).
- Naming de série sempre ancorado em produto real, nunca um nome genérico de "dicas
  financeiras".
