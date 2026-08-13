---
name: reels-planejador
description: >
  Monta a grade semanal ou mensal de Reels da Felizcred (temas, formatos, volume por dia,
  redes) já num formato pronto pra colar no formulário da Agenda do painel. Use quando o
  usuário disser "planeja o calendário de reels", "grade semanal", "quantos reels por
  semana", "organiza o mês de conteúdo" ou pedir um plano de publicação. Quarto passo do
  sistema de produção de Reels da Felizcred.
---

# Reels — Planejador de Conteúdo

## CRITICAL: ao carregar

Vá direto pro Passo 1.

## Passo 1. Levantar os parâmetros

Se o usuário já disse volume/período/canais, use e pule pro Passo 2. Senão pergunte com
AskUserQuestion:

```json
[
  {
    "question": "Quantos Reels por semana você consegue produzir?",
    "header": "Volume",
    "multiSelect": false,
    "options": [
      {"label": "3 por semana", "description": "Ritmo leve, sustentável pra começar"},
      {"label": "5 por semana (1 por dia útil)", "description": "Ritmo consistente"},
      {"label": "7 por semana (todo dia)", "description": "Ritmo agressivo, precisa de produção em lote"},
      {"label": "Outro número", "description": "Vou dizer o número exato"}
    ]
  },
  {
    "question": "Período do plano?",
    "header": "Período",
    "multiSelect": false,
    "options": [
      {"label": "1 semana", "description": "Grade da próxima semana"},
      {"label": "1 mês", "description": "Grade do mês inteiro"}
    ]
  }
]
```

Redes: por padrão, todas as que o Publique IV já publica pra conta Felizcred (Instagram,
Facebook, Threads, LinkedIn — confirme com `GET /painel/api/publicar/contas` se tiver acesso,
senão assuma essas 4 e avise que pode ajustar). X/Twitter fica de fora até ter credencial.

## Passo 2. Distribuir os 5 produtos ao longo da grade

Os 5 produtos da Felizcred (`../_felizcred-reels-voz.md`) formam os pilares de tema — não
deixe nenhum dominar mais de 40% dos slots, e gire entre eles pra não postar sempre a mesma
coisa. Reserve 1 slot por semana como "flexível" (tema reativo, sem definir agora).

Cada linha da grade tem: dia, horário sugerido, produto/tema, ângulo (curto — a ideia
completa vem depois pela reels-ideias/reels-copywriter), redes.

**Horário sugerido**: manhã (8h-10h) ou noite (19h-21h), horário de Brasília — quando o
público CLT costuma estar no celular fora do trabalho.

## Passo 3. Formato de saída — já no formato dos campos da Agenda

A Agenda (`/painel` → aba 🚀 Publicar → card Agenda) tem 4 campos por post: **Conta**
(Felizcred), **Texto/legenda**, **Redes** (checkboxes) e **Agendar para** (data+hora exata,
um campo só, não dia e hora separados). Gere a tabela já pensando nisso:

```
GRADE DE REELS — [período]

| Dia/Data | Hora | Produto/Tema | Ângulo | Redes |
|---|---|---|---|---|
| Segunda 18/08 | 08:00 | Consignado CLT | ... | IG, FB, Threads |
| Terça 19/08 | 19:00 | Seguro de carro | ... | IG, FB |
| Quarta 20/08 | — | [Flexível — tema reativo] | — | — |
...
```

Depois diga: "Pra cada linha, chame reels-ideias (se quiser a ideia detalhada) e depois
reels-copywriter pra virar roteiro. Quando o vídeo estiver gravado e editado, cadastra na
Agenda com o dia+hora exatos dessa tabela — campo 'Agendar para' aceita data e hora juntos."

## Regras

- Nunca mais de 40% dos slots no mesmo produto.
- Sempre reservar espaço flexível (não preencher tudo).
- Não inventar um canal que o Publique IV não publica de verdade — confira a lista real em
  vez de assumir.
- Datas sempre absolutas (dia da semana + data), nunca "essa semana"/"semana que vem" solto.
