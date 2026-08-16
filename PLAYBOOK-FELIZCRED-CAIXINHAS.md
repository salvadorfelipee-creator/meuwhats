# Playbook — 50 caixinhas de pergunta (Felizcred)

Série de 50 Instagram Stories no formato "caixinha de pergunta do Instagram"
(skill `caixinha-pergunta-instagram`, medidas pixel-validadas: caixa 675px de
largura, cabeçalho 103px, área da pergunta 189px, top 124px, `border-radius`
30px), cobrindo dúvidas de trabalhador CLT em geral (não só produtos de
crédito): direitos trabalhistas, FGTS, demissão/rescisão, INSS, consignado,
PIS/abono, golpes financeiros, seguros e dívidas.

## ⚠️ Desvio da regra padrão da skill — fundo em vídeo, não foto real da marca

A regra normal da skill é: fundo sempre **foto real da própria marca**. A
Felizcred não tinha nenhuma foto real disponível (só logo/ícones do blog).
Alertei o usuário que os dois vídeos fornecidos como alternativa
(`From Klickpin.com- ...mp4`, baixados de um "downloader" de vídeos do
Pinterest, mostrando só xícaras de café, sem relação com CLT/FGTS/Felizcred,
com cara de conteúdo gerado por IA e sem direito de uso comercial garantido)
não atendiam nem à regra da skill nem ao pedido original desta tarefa. O
usuário decidiu usar mesmo assim ("vamos usar pois prende a atenção") — decisão
consciente e explícita, registrada aqui para o caso de isso precisar ser
revisto depois (ver `feedback_content_rights_video_sourcing.md`).

## Conteúdo

Fonte: 20 artigos reais de `felizcred-site/blog/*.html` (extraídos por texto,
sem inventar valor/prazo/regra) + 1 fato confirmado via WebSearch (estabilidade
gestante = até 5 meses após o parto, CLT/ADCT art. 10 — não estava no blog).
Arquivo completo: `felizcred-caixinhas/conteudo_master.json` (id, categoria,
modo, pergunta, resposta).

10 categorias, 50 perguntas: Direitos CLT gerais (10), FGTS (6), Demissão/
rescisão (6), INSS (8), Consignado (6), PIS/Abono (2), Golpes (3), Seguros
(4), Dívidas (2), Diversos (3).

## Dois formatos

- **38 "texto"** — caixinha com a pergunta + resposta escrita no rodapé
  (gradiente escuro), vídeo mudo de 6s em loop, publicado só como
  **Instagram Story**.
- **12 "áudio"** — caixinha só com a pergunta (sem resposta escrita); a
  resposta sai em áudio (`pt-BR-AntonioNeural`, via `edge-tts`, grátis).
  Publicado como **Story** (mesmo visual, mudo, 6s) **e também como Reels**
  (mesmo visual, com o áudio, duração = duração da narração, ~14-20s).

Os 12 de áudio foram escolhidos pelo gancho/curiosidade mais forte (ex.
"Hora extra tem que pagar quanto a mais?", "Gestante pode ser demitida
durante a gravidez?"), espalhados pelas 10 categorias.

## Fundo em vídeo — os dois clipes intercalados

- `From Klickpin.com- Discover Easy weekend getaway inspiration...mp4` (item ímpar)
- `From Klickpin.com- Lovely daily organization tips...mp4` (item par)

Alternância por paridade do `id` (1-50), não por categoria — item ímpar usa
o clipe 1, par usa o clipe 2.

## Ordem e calendário

Rodízio pelas 10 categorias (mesma lógica do
`PLAYBOOK-COTACERTA-100-CAIXINHAS.md`) — garante variedade de assunto em
qualquer janela de posts. 2 Stories/dia, **09h e 16h de Brasília**, de
**18/08 a 11/09/2026** (25 dias) — horários escolhidos pra não colidir com
as outras séries já agendadas na conta felizcred (12h e 18h BRT ocupados
pelas séries de crédito/informativos CLT). Reels correspondentes saem 6
minutos depois do Story irmão, mesmo dia.

IDs na agenda: **251 a 312** (62 no total — 50 Stories + 12 Reels).

## Armazenamento (R2)

Checado antes de rodar o lote: bucket `felizcred-reels` estava em 393,5 MB
de 10 GB grátis/mês (Cloudflare R2). Esta série soma ~88 MB (56 MB de
Stories + 32 MB de Reels) — total final ~480 MB, ~5% do limite grátis.

## Status

- [x] Playbook de conteúdo aprovado pelo usuário (50 perguntas, categorias e
  quantidade de áudio)
- [x] Uso do fundo em vídeo (em vez de foto real) aprovado explicitamente
  pelo usuário, após alerta sobre origem/direitos do conteúdo
- [x] 50 overlays transparentes gerados (Playwright, `gerar_overlays.py`)
- [x] 12 áudios gerados (edge-tts, voz Antônio pt-BR)
- [x] 62 vídeos finais compostos (fundo em vídeo + overlay, `gerar_video_bg.py`)
- [x] 62 posts agendados via `/painel/api/agenda` — 1 erro passageiro (502)
  no meio do lote, identificado por diff de timestamps e reenviado com
  sucesso; confirmado 50 Stories + 12 Reels na fila (IDs 251-312)

## Como foi feito (pra repetir depois)

1. Extração de texto de 20 artigos do blog (`felizcred-site/blog/*.html`) via
   regex simples (remove `<style>`/`<script>`, tira tags), sem usar dado que
   não estivesse explícito no artigo
2. 1 fato confirmado via WebSearch (estabilidade gestante) por não constar
   no blog com o nível de detalhe necessário
3. Redação das 50 perguntas em 2ª pessoa (mesmo tom da série
   `PLAYBOOK-INFORMATIVOS-CLT.md`), aprovação do usuário via lista completa
4. `python3 felizcred-caixinhas/gerar_overlays.py conteudo_master.json --out ./saida`
   — gera `overlay.png` transparente (Playwright, `omit_background=True`)
   por item, reaproveitando as medidas da skill mas sem a camada `.bg`
5. `python3 "C:\Users\Salvador\.claude\skills\caixinha-pergunta-instagram\gerar_audio.py" ./saida --voz pt-BR-AntonioNeural`
   — reaproveita o script padrão da skill (lê `resposta_audio.txt`)
6. `python3 felizcred-caixinhas/gerar_video_bg.py conteudo_master.json --saida ./saida --video1 ... --video2 ...`
   — ffmpeg: fundo em loop (`-stream_loop -1`) escalado/cortado pra 1080x1920
   + overlay transparente por cima (`filter_complex overlay`); `story.mp4`
   sempre mudo (6s); `reels.mp4` só nos itens de áudio, com `-shortest`
   puxando a duração do `resposta.mp3`
7. `python3 felizcred-caixinhas/montar_ordem.py conteudo_master.json --out schedule.json --inicio 2026-08-18`
   — rodízio pelas categorias + datas/horários em horário de Brasília
   (formato `YYYY-MM-DDTHH:MM`, o que `POST /painel/api/agenda` espera)
8. `python3 felizcred-caixinhas/agendar.py schedule.json --saida ./saida`
   — um POST por Story e por Reels; qualquer falha isolada dá pra
   reidentificar comparando os timestamps esperados (`schedule.json`) contra
   os que realmente ficaram na fila (`GET /painel/api/agenda/fila`)

Arquivos-fonte todos em `felizcred-caixinhas/` (conteúdo, scripts e
`saida/NNN/` com overlay/áudio/vídeos de cada item).
