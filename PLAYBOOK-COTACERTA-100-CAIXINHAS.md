# Playbook — 100 caixinhas de pergunta (Cota Certa Seguros)

Série de 100 Instagram Stories no formato "caixinha de pergunta do Instagram"
(estilo real, avatar/pergunta compacta — validado com o usuário comparando
com o `modelo de post pronto sem audio.png` até bater exatamente nas
proporções: caixa 675px de largura, cabeçalho 103px, área da pergunta 189px,
top 124px, `border-radius` 30px), usando a foto real da moto do Cota Certa
(`cotacerta-seguros/img/foto original.png`, nunca gerada por IA).

Fonte do conteúdo: `Cartilha_Cota_Certa_Seguros_100_Perguntas_Instagram.md`
(as 100 perguntas/respostas originais, ver `Manual_Mestre_Cota_Certa_Seguros.md`
pra tom/posicionamento).

## Dois formatos

- **65 "texto"** — caixinha só com a pergunta + resposta escrita no rodapé
  (sobre gradiente escuro), publicada como **Instagram Story**.
- **35 "áudio"** — caixinha só com a pergunta (sem resposta escrita), a
  resposta sai só em **áudio** (voz `pt-BR-AntonioNeural`, via `edge-tts` —
  gratuito, sem conta, mesmo motor de voz da Azure). Publicada como
  **Instagram Story** (a imagem) **e também como Reels** (a mesma imagem +
  o áudio, virando vídeo de ~14s via `ffmpeg`).

As 35 de áudio foram escolhidas pelas perguntas com gancho/curiosidade mais
forte (myth-busting, dor específica, pergunta direta do público), espalhadas
pelos 5 pilares da cartilha (moto, carro, vida/acidentes, odontológico,
dúvidas gerais) e distribuídas ao longo dos 100 posts pra não concentrar
tudo de áudio num dia só.

## Ordem e calendário

Os 100 itens são intercalados em rodízio pelos 5 pilares (1 de cada tema por
"rodada", 20 rodadas) — garante variedade de assunto em qualquer janela de
10 posts. 10 posts/dia, 5 às 8h (escalonados de 3 em 3 min) e 5 às 19h30
(idem), de **17/08 a 26/08** (10 dias). Reels correspondentes saem 6 minutos
depois do Story irmão, mesmo dia.

IDs na agenda: **116 a 250** (135 no total — 100 Stories + 35 Reels).

## Status

- [x] Suporte a Reels (vídeo) adicionado na agenda multi-rede — `posts_agendados.video_key`,
  rede `instagram_reels` no Publique IV (reaproveita credencial do Instagram feed/Story de
  cada conta), rota `/painel/api/agenda` aceita `videoBase64`. Ver commit "Adiciona suporte
  a Reels (vídeo) na agenda multi-rede".
- [x] 100 imagens geradas (Playwright, mesma foto real da moto em todas — único ativo
  fotográfico de marca disponível)
- [x] 35 áudios gerados (edge-tts, voz Antônio pt-BR)
- [x] 35 vídeos de Reels gerados (ffmpeg, imagem + áudio, 1080×1920, ~14s cada)
- [x] 135 posts agendados via `/painel/api/agenda` — 0 erros, confirmado ao vivo
  (`instagram_story`: 100, `instagram_reels`: 35)

## Como foi feito (pra repetir depois)

1. Transcrição das 100 perguntas/respostas da cartilha pra dados estruturados
   (`content_100.py`), sem alterar o conteúdo factual/compliance da cartilha
2. Escolha das 35 IDs pra áudio, calculando posições espalhadas por pilar via
   fórmula de distribuição uniforme (evita cluster de áudio num trecho só)
3. Rodízio pelos 5 pilares pra montar a ordem final dos 100 (`montar_ordem.py`)
4. Geração das 100 imagens em lote — um único browser Playwright, HTML/CSS
   reaproveitando o template validado da caixinha "Bate bola"
5. Geração dos 35 áudios em lote via `edge_tts.Communicate(texto, "pt-BR-AntonioNeural").save(...)`
6. Geração dos 35 vídeos via `ffmpeg -loop 1 -i arte.png -i resposta.mp3 -c:v libx264
   -tune stillimage -c:a aac -pix_fmt yuv420p -vf scale=1080:1920 -shortest reels.mp4`
7. Agendamento via `/painel/api/agenda`, `contaId: "cotacerta"` — Stories com
   `redes: ["instagram_story"]` + `imagemBase64`; Reels com
   `redes: ["instagram_reels"]` + `videoBase64`
