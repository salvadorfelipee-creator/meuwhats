# Playbook — 8 carrosséis "formato tuiter" (Cota Certa Seguros)

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
- **Datas**: cadência "dia sim, dia não" de 17 a 31/08, sempre às 15h — horário
  livre, não bate com os posts da Felizcred/Ciahot (10h/12h/18h/20h). Os 4
  primeiros temas (motoboy/Uber) foram os pedidos originalmente; os 4
  seguintes foram criados pra completar a cadência intercalada até o fim do
  mês, ampliando um pouco o público pra qualquer motorista/segurado.

## Calendário

| # | Data | Horário | Tema | Artigo (arquivo em cotacerta-seguros/blog/) | ID agenda |
|---|------|---------|------|------|------|
| 1 | 17/08 | 15h | Seguro pra motorista de app (Uber/99): o que a plataforma cobre e o que não cobre | seguro-motorista-app-uber-99.html | 100 |
| 2 | 19/08 | 15h | Seguro pra carro financiado: a dívida some se o carro for roubado? | seguro-carro-financiado-obrigatorio.html | 104 |
| 3 | 21/08 | 15h | Seguro de moto pra motoboy/entregador: vale a pena? | seguro-moto-motoboy-entregador.html | 101 |
| 4 | 23/08 | 15h | Classe de bônus: quando você perde (e quando não) | classe-bonus-seguro-quando-perde.html | 105 |
| 5 | 25/08 | 15h | Seguro de vida vale a pena pra quem não tem filho? | seguro-de-vida-vale-a-pena.html | 102 |
| 6 | 27/08 | 15h | Seguro de invalidez permanente: e se sua renda passar do teto do INSS? | seguro-invalidez-permanente.html | 106 |
| 7 | 29/08 | 15h | Seguro Renda Protegida (DIT) pra autônomo/MEI/motorista de app | seguro-renda-protegida-o-que-e.html | 103 |
| 8 | 31/08 | 15h | Seguro auto pra quem roda por aplicativo: como declarar certo | porto-seguro-auto.html | 107 |

## Status

- [x] Conteúdo aprovado pelo usuário
- [x] 40 imagens geradas (8 carrosséis × 5 slides, skill `carrossel-formato-tuiter`, modo `feed`)
- [x] 8 carrosséis agendados via `/painel/api/agenda` (`redes: ["instagram"]`, `contaId: "cotacerta"`) — IDs 100-107 na fila, cadência dia-sim-dia-não completa
- [x] Facebook da Página "Cota certa seguros" (`105193575892026`) confirmado dentro do mesmo
  Portfólio Empresarial da Felizcred — token de Página real gerado e testado
  (`debug_token`: tipo PAGE, não vence, com `pages_manage_posts`). Falta só o
  usuário colocar `FACEBOOK_COTACERTA_PAGE_ID` e `FACEBOOK_COTACERTA_PAGE_ACCESS_TOKEN`
  no Render (valores em `CHAVES-LOCAL.md`).
- [ ] Instagram (feed + Story) — `@cotacertaseguros` (`17841437674153172`) confirmado
  conectado ao mesmo Portfólio, mas o token de usuário atual não tem a permissão
  `instagram_content_publish` (só lê, não publica). Falta o usuário gerar um
  token novo com essa permissão extra (passo a passo em `CHAVES-LOCAL.md`,
  seção "Cota Certa Seguros — conexão Meta"); assim que existir, Stories
  acende junto (já codificado em `publique.js`, sem precisar mexer em nada).
- [ ] Twitter/LinkedIn/Threads do Cota Certa: ainda não configurados

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
