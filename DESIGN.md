---
name: FelizCred
description: Crédito acompanhado em uma conversa clara e segura.
colors:
  primary: "#00c853"
  primary-deep: "#08783b"
  navy: "#071423"
  navy-surface: "#0a2138"
  mint-surface: "#eef8f2"
  white: "#ffffff"
  muted: "#b8c7d2"
typography:
  display:
    fontFamily: "Sora, sans-serif"
    fontSize: "clamp(2.625rem, 5.5vw, 4.625rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  control: "12px"
  surface: "22px"
  showcase: "28px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "22px"
  lg: "38px"
  xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.navy}"
    rounded: "{rounded.control}"
    padding: "16px 32px"
---

# Design System: FelizCred

## Overview

**Creative North Star: "A conversa em movimento"**

A interface mostra a contratação acontecendo, em vez de apenas descrevê-la. O mundo visual combina o azul-marinho institucional com superfícies claras de produto e verde usado para ação, progresso e confirmação. A página é confiante, humana e demonstrativa.

**Key Characteristics:**
- Demonstrações reais do chat em molduras de celular e navegador.
- Uma ação principal por seção: iniciar ou continuar a simulação.
- Movimento automático calmo, sempre pausável e compatível com redução de movimento.

## Colors

O azul-marinho cria confiança; o verde aparece somente em ações e estados positivos; superfícies claras tornam o produto legível.

**The Action Green Rule.** Verde vivo indica ação, seleção ou progresso — nunca texto decorativo extenso.

## Typography

**Display Font:** Sora
**Body Font:** DM Sans

Sora dá autoridade às promessas principais; DM Sans mantém explicações e formulários fáceis de ler.

**The Short Headline Rule.** Títulos grandes usam frases diretas, largura equilibrada e no máximo três ideias visuais.

## Layout

O conteúdo usa contêineres entre 1200 e 1380px. Seções de demonstração alternam texto e produto em uso. Abaixo de 900px, toda grade vira uma coluna; abaixo de 600px, controles ocupam a largura disponível e demonstrações removem detalhes secundários.

## Elevation & Depth

Sombras amplas e neutras elevam somente as molduras principais. Elementos internos usam contraste tonal e divisores, evitando caixas aninhadas sem função.

## Shapes

Controles usam cantos firmes de 12px; superfícies de produto usam 18–22px; grandes showcases usam 28px. Pílulas ficam restritas a status curtos.

## Components

### Buttons
- **Primary:** verde, texto azul-marinho, raio de 12px e feedback de pressão.
- **Secondary:** transparente, contorno discreto e contraste claro.
- **Focus:** anel visível em verde translúcido.

### Cards / Containers
- Superfícies escuras organizam narrativa; superfícies claras representam o produto funcionando.
- O destaque selecionado usa fundo branco e transição curta de opacidade e posição.

### Navigation
- Barra azul-marinho fixa, marca à esquerda e uma única ação verde à direita.

### Product demonstration
- Molduras de navegador e celular mostram mensagens, etapas e ações plausíveis do fluxo real.
- A alternância automática pausa em hover e foco e respeita `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** mostrar o chat executando uma etapa real da jornada.
- **Do** manter o site como canal principal e WhatsApp como continuidade secundária.
- **Do** usar provas sociais somente quando forem reais e autorizadas.

### Don't:
- **Don't** voltar a blocos vazios com texto concentrado em uma única coluna.
- **Don't** prometer aprovação, prazo ou valor sem confirmação da instituição financeira.
- **Don't** usar números de clientes ou depoimentos fictícios.
