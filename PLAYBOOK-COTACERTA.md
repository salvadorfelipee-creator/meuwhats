# Playbook — 4 carrosséis "formato tuiter" (Cota Certa Seguros)

Série de carrosséis pro Instagram feed da Cota Certa Seguros, no formato de
print de post do X/Twitter (skill `carrossel-formato-tuiter`, modo `feed`,
com logo e fontes da própria marca — Poppins + Inter, não a Sora/DM Sans
da Felizcred).

Cada carrossel tem 5 slides (gancho → contexto → detalhe → benefício → CTA
com card de link pro artigo do blog cotacertaseguros.com.br/blog).

## Metodologia

- **Público**: motoboys, entregadores de app e motoristas de Uber/99 —
  quem depende do veículo pra gerar renda todo dia.
- **Temas**: os artigos já publicados em `cotacerta-seguros/blog/` mais
  relevantes pra esse público (conteúdo real, sem inventar dado — cada
  carrossel linka pro artigo correspondente e todo fato usado nos slides
  vem do FAQ/corpo do próprio artigo).
- **Datas**: intercaladas com o que já estava agendado pra Felizcred e
  Ciahot em agosto (que ocupam os horários de 10h/12h/18h/20h) — os
  carrosséis do Cota Certa rodam às 15h, um a cada ~4 dias.

## Calendário

| # | Data | Horário | Tema | Artigo (arquivo em cotacerta-seguros/blog/) |
|---|------|---------|------|------|
| 1 | 17/08 | 15h | Seguro pra motorista de app (Uber/99): o que a plataforma cobre e o que não cobre | seguro-motorista-app-uber-99.html |
| 2 | 21/08 | 15h | Seguro de moto pra motoboy/entregador: vale a pena? | seguro-moto-motoboy-entregador.html |
| 3 | 25/08 | 15h | Seguro de vida vale a pena pra quem não tem filho? | seguro-de-vida-vale-a-pena.html |
| 4 | 29/08 | 15h | Seguro Renda Protegida (DIT) pra autônomo/MEI/motorista de app | seguro-renda-protegida-o-que-e.html |

## Status

- [x] Conteúdo aprovado pelo usuário
- [x] 20 imagens geradas (4 carrosséis × 5 slides, skill `carrossel-formato-tuiter`, modo `feed`)
- [x] 4 carrosséis agendados via `/painel/api/agenda` (`redes: ["instagram"]`, `contaId: "cotacerta"`) — IDs 100-103 na fila
- [ ] Redes do Cota Certa (Instagram/Facebook/Twitter/LinkedIn/Threads) ainda não conectadas —
  publicação real só acontece depois que as credenciais forem configuradas no Render
  (ver seção "Cota Certa" em `publique.js`, mesmo padrão da Felizcred/Ciahot)

## Como foi feito (pra repetir depois)

1. Leitura dos artigos reais em `cotacerta-seguros/blog/*.html` — título +
   respostas do FAQPage schema de cada um, pra usar como fonte factual
   (nenhum dado, preço ou regra foi inventado)
2. Recorte do ícone da marca a partir de `cotacerta-seguros/img/logo.png`
   (o "C" com o check verde), salvo em
   `C:\Users\Salvador\.claude\skills\carrossel-formato-tuiter\assets\cotacerta-icon.png`
3. `generate.py` da skill ganhou suporte a `--icon`, `--fonte-nome` e
   `--fonte-corpo` (antes só funcionava com a logo/fontes da Felizcred) —
   isso permite reusar o mesmo pipeline pra qualquer marca nova
4. Geração via:
   ```
   python3 "C:\Users\Salvador\.claude\skills\carrossel-formato-tuiter\generate.py" conteudo.json \
     --mode feed --out ./saida --nome "Cota Certa" --handle "@cotacertaseguros" \
     --icon ".../assets/cotacerta-icon.png" --fonte-nome "Poppins" --fonte-corpo "Inter"
   ```
5. Agendamento em `/painel/api/agenda` com `imagensBase64` (array de 5
   imagens = vira carrossel automaticamente no Instagram) — ver `agenda.js`
