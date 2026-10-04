---
name: carrossel-formato-tuiter
description: "Gera carrossel do Instagram (feed) ou slide de Story da Felizcred no formato de print de post do X/Twitter — avatar com a logo real, nome + selo azul de verificado, @handle, texto e barra de engajamento (comentário/retweet/curtir/compartilhar). Use quando o usuário disser 'carrossel formato tuiter', 'carrossel estilo X/Twitter', 'post no formato tweet', 'print de tweet pro Instagram', ou pedir para repetir esse layout com um tema novo. Já vem com a logo da Felizcred, as fontes de marca (Sora + DM Sans) e os dois formatos prontos — só falta o conteúdo (texto de cada slide)."
---

# Carrossel formato tuiter (Felizcred)

Reproduz fielmente um print de post do X/Twitter clássico (fundo branco, avatar
circular, nome em negrito + selo azul, @handle em cinza, texto do post, barra de
engajamento com ícones finos) usando a **logo real da Felizcred** e as fontes
oficiais da marca — **Sora** no nome, **DM Sans** no resto (mesmas do site,
`felizcred-site/index.html`). Validado ao vivo: publicado com sucesso tanto em
carrossel de feed quanto em Story via Publique IV.

## Quando usar

- Pedido de "carrossel formato tuiter" / "carrossel estilo X" / "post tipo tweet"
- Continuação de um carrossel já feito nesse layout, com tema novo
- Slide avulso pra testar como um post ficaria nesse formato

## O que já está pronto (não precisa recriar)

- `assets/felizcred-icon.png` — a logo oficial já recortada (ícone "F", sem o
  wordmark), pronta pra embutir como avatar. **Nunca recriar/aproximar a logo
  com iniciais "FC" ou texto — sempre usar este arquivo.** Se a logo mudar um
  dia, recortar a nova a partir do arquivo fornecido pelo usuário (ver processo
  abaixo) e substituir este PNG.
- `generate.py` — gera os PNGs finais direto (HTML → Playwright → PNG), sem
  precisar montar CSS na mão a cada pedido.

## Dois modos — não confundir

| Modo | Tamanho | Uso | Por quê |
|---|---|---|---|
| `feed` (default) | 1080×1350 (4:5) | Carrossel normal do feed | Cartão branco menor, centralizado, **com sombra, sobre fundo cinza claro** — não ocupa a imagem inteira |
| `story` | 1080×1920 (9:16) | **Só** quando for publicar como Instagram Story | Mesmo tratamento de cartão+sombra, só que com margem de segurança extra pro cabeçalho e pra barra "Diga algo..." do Instagram |

⚠️ **O cartão nunca deve ocupar a imagem inteira** (sem fundo/sombra visível ao
redor) — já aconteceu de o feed sair "colado na borda" sem parecer um
screenshot de verdade, e teve que ser refeito. O que dá a sensação de "print
real" é exatamente esse respiro + sombra ao redor do cartão, nos dois modos.

⚠️ **Nunca publicar uma imagem `feed` (4:5) direto como Story.** O Instagram
estica/corta pra caber no 9:16 e corta o texto nas bordas — já aconteceu uma vez
nesta conta. Se o destino for Story, sempre gerar com `--mode story`.

## Como usar

1. Escrever o conteúdo de cada slide num JSON (lista de objetos):

```json
[
  { "text": "Texto do slide 1.\n\nPode ter mais de um parágrafo, igual um tweet real." },
  { "text": "Texto do slide 2." },
  { "text": "Texto do slide 3." }
]
```

Os números de engajamento (`comments`, `retweets`, `likes`) são **opcionais** —
se omitidos, o script gera números plausíveis e crescentes automaticamente
(slide 1 tem menos, o último tem mais). Só informar na mão se o usuário pedir
números específicos:

```json
{ "text": "...", "comments": 47, "retweets": 312, "likes": 1204 }
```

2. Rodar (Playwright precisa estar instalado — já confirmado funcionando neste
   ambiente; se faltar, `pip3 install playwright && python3 -m playwright install chromium`):

```bash
python3 "C:\Users\Salvador\.claude\skills\carrossel-formato-tuiter\generate.py" conteudo.json --mode feed --out ./saida
```

Gera `slide_1.png`, `slide_2.png`, ... na pasta `--out`, já no tamanho certo,
prontos pra revisar e depois publicar.

3. Mostrar os PNGs gerados pro usuário revisar antes de considerar pronto
   (Read tool) — igual ao fluxo já validado: gerar, mostrar, ajustar se pedir,
   só então publicar.

## Publicar (Publique IV)

Esse layout já foi publicado com sucesso via `POST /painel/api/publicar`
(`https://meuwhats.onrender.com`, auth básica — ver `CHAVES-LOCAL.md` na raiz
do projeto `meuwhatsapp`). Corpo da requisição:

```json
{ "imagemBase64": "data:image/png;base64,...", "redes": ["instagram_story"] }
```

`redes` pode ser `["instagram_story"]` (Story — usar imagem `--mode story`) ou
o valor certo pra feed/carrossel conforme o Publique IV suportar. `contaId`
default já é `"felizcred"`, não precisa informar.

## Se a logo mudar

O ícone embutido veio de um arquivo fornecido pelo usuário
(`felizcred-site/logo/*.png`), recortado só a marca "F" (sem o wordmark
"FelizCred" ao lado). Pra atualizar:

```python
from PIL import Image
img = Image.open("caminho/do/novo/logo.png")
# ajustar a caixa de recorte visualmente (ler o resultado, refinar até isolar só o ícone)
crop = img.crop((x0, y0, x1, y1))
crop.save("C:/Users/Salvador/.claude/skills/carrossel-formato-tuiter/assets/felizcred-icon.png")
```

## Detalhes de fidelidade visual (não mexer sem motivo)

- Nome "Felizcred" em **Sora** peso 700 (bate com a fonte da logo/site)
- Resto do texto em **DM Sans**
- Cores: texto principal `#0f1419`, texto secundário/ícones `#667080`, selo
  `#1d9bf0` — paleta do X, não a paleta verde da Felizcred (o objetivo é
  parecer um print genuíno do X, a marca aparece só na logo do avatar)
- Emoji: evitar 🧵 (símbolo de "thread" do X, não comunica nada pro público do
  Instagram) — preferir 👇 ou nenhum
