# Site da Especitá Odontologia e Estética

Site estático (HTML, CSS e JS puros, sem framework), feito para ser publicado na Vercel como
projeto próprio, igual ao `felizcred-site/`. Páginas geradas a partir de um arquivo de conteúdo,
para que textos possam ser editados sem mexer em HTML.

## O que já está pronto

| Página | Arquivo | Função |
|---|---|---|
| Início | `index.html` | Visão geral, serviços, como funciona, urgência, localização |
| Dente quebrado | `dente-quebrado.html` | Urgência + checklist que preenche o WhatsApp |
| Dor de dente | `dor-de-dente.html` | Urgência + triagem de 2 perguntas |
| Implante dentário | `implante-dentario.html` | Antes/depois ilustrativo + quiz "qual é o meu caso" |
| Ortodontia | `ortodontia.html` | Comparador fixo x alinhador |
| Alinhador invisível | `alinhador-invisivel.html` | Comparador fixo x alinhador |
| Odontopediatria | `odontopediatria.html` | Calculadora "quando levar meu bebê" |
| Tratamento geral e família | `tratamento-odontologico.html` | Lista de serviços, convênio, família |
| Harmonização facial | `harmonizacao-facial.html` | Simulador ilustrativo de linhas de expressão |
| Clareamento dental | `clareamento-dental.html` | Escala de tons ilustrativa |
| Lente de contato dental | `lente-de-contato-dental.html` | Conteúdo + FAQ |
| Avaliação / Dentista em Brusque | `dentista-em-brusque.html` | Página "guarda-chuva" local |
| A Dra. | `sobre.html` | Perfil (formação a preencher) |
| Contato | `contato.html` | WhatsApp, endereço, mapa |
| Privacidade / Termos | `privacidade.html`, `termos.html` | Exigidos pela Meta e pela LGPD (CNPJ e e-mail a preencher) |

Cada página de serviço tem: título e descrição para o Google, dados estruturados (clínica,
procedimento, perguntas frequentes, breadcrumb), FAQ pesquisável, botões de WhatsApp com texto
pré-preenchido (a origem "vim pelo site" + utm chega no painel), ficha da Dra. com CRO e bloco de
localização. Também: `sitemap.xml`, `robots.txt`, `llms.txt` (para buscadores de IA), `vercel.json`
(URLs sem .html), favicon.

Regras de conteúdo (Código de Ética Odontológica): sem preço, sem "grátis", sem promoção, sem
promessa de resultado, sem depoimento. Nome + CRO em todas as páginas. As ferramentas
interativas são **ilustrativas** e dizem isso na tela.

## Como editar

1. Textos, FAQ, serviços, endereço, horário, WhatsApp: `_build/content.py`.
2. Estilo: `assets/css/site.css`. Comportamento (quiz, sliders, WhatsApp): `assets/js/site.js`.
3. Gerar as páginas de novo:

```bash
cd "especita clinica/site/_build" && python build_site.py
```

4. Ver localmente: abra `index.html` no navegador (os links sem `.html` funcionam só na Vercel;
   localmente use `vercel dev` ou um servidor simples).

Para acrescentar um serviço: copiar um bloco `dict(...)` em `SERVICOS`, trocar slug/textos,
rodar o build. A página, o sitemap, o llms.txt e os links do rodapé atualizam sozinhos.

## O que falta e depende do Salvador ou da clínica

Ordem sugerida. O prompt pronto para outra conversa está em `PROMPT-PARA-COLAR.md`.

1. **Domínio**: comprar (sugestão: `clinicaespecita.com.br`, já que o antigo não resolve; conferir
   no Registro.br se está livre ou se a clínica ainda é dona). Se o domínio final for outro,
   trocar `SITE["dominio"]` em `content.py` e rodar o build (canonical, sitemap e llms.txt usam ele).
2. **Vercel**: novo projeto apontando para a pasta `especita clinica/site` (Root Directory),
   framework "Other", sem build command. Depois, adicionar o domínio e apontar o DNS.
3. **Fotos reais**: Dra. (hero da home e página sobre), fachada, recepção, consultório. Os
   lugares estão marcados com "(substituir)". Formato recomendado: 1200×1600 (retrato) e
   1600×1000 (ambientes), comprimidas (< 300 KB).
4. **Imagem de compartilhamento** `assets/img/og.png` (1200×630): existe uma versão provisória
   gerada com o nome da clínica; trocar por foto real.
5. **Dados a preencher**: formação da Dra. (`sobre`), CNPJ e e-mail de contato (`privacidade`),
   convênios aceitos (`tratamento-odontologico`), coordenadas exatas no mapa (`SITE["geo"]`).
6. **Google**: Perfil da Empresa reivindicado pela clínica; Search Console com o sitemap;
   embed do Google Maps no bloco "Mapa" (trocar o placeholder em `build_site.py`, função
   `local_block`).
7. **Medição**: GA4 e Meta Pixel + API de Conversões (quando a Meta estiver verificada). Eventos
   a marcar: clique no WhatsApp (todos os botões têm `data-wa-text`), envio do quiz, clique em
   "Como chegar". Rastreio do Google Ads: conversão "clique no WhatsApp" como principal.
8. **E-mail profissional** no domínio (ex.: contato@…) e o endereço nas páginas legais.
9. **Textos pré-preenchidos por campanha**: cada anúncio usa um link com `?utm_source=meta&utm_campaign=implante`; o botão de WhatsApp acrescenta a origem na mensagem, e o painel grava a etiqueta.

## Decisões de design (v2, 05/10/2026)

Direção: editorial clínica, no padrão dos sites de clínica premiados em 2026 (referência estudada:
Aventura Dental Arts, Awwwards SOTD 03/2026: duas cores, serifa grande com itálico, foto em tela
cheia, texto que atravessa a imagem).

- **Duas cores**: marfim quente `#EFEBE4` e grafite esverdeado `#161A19`. Sem cor de acento nos
  blocos; o verde aparece só no hover do WhatsApp.
- **Tipografia**: Instrument Serif (títulos, itálico como voz) + Hanken Grotesk (texto). Google Fonts.
- **Sem cards com ícones, sem blobs, sem eyebrows em todo canto.** Serviços são um índice numerado
  com prévia de foto no hover; passos são cartões empilhados (sticky); a Dra. é um perfil de revista.
- **Movimento**: Lenis (rolagem suave) + GSAP ScrollTrigger (parallax da foto, texto que atravessa
  a banda, botão magnético). Reveals em CSS + IntersectionObserver. Tudo desliga com
  `prefers-reduced-motion`; efeitos de mouse só em `(hover:hover) and (pointer:fine)`.
- **Ferramentas interativas** em bloco grafite, uma por serviço, sempre ilustrativas e com aviso
  (CFO: sem promessa de resultado; LGPD: sem foto do visitante).
- **Sem formulário de e-mail**: tudo vai para o WhatsApp, onde a recepção atende e o painel mede.

## Componentes (passada de 05/10, padrões portados do 21st.dev para HTML puro)

| Componente | Padrão de referência | Como ficou |
|---|---|---|
| Botões | "Interactive Hover Button" | ponto que expande no hover, seta que entra da direita; versão clara e escura |
| Passo a passo | "Timeline" (cubby-ui) | linha vertical com marcadores numerados e foto fixa ao lado; substitui os cartões empilhados |
| FAQ | "Two-Column FAQ" | título fixo à esquerda, acordeão à direita, pergunta em sans 19px |
| Hero | "Editorial Collage Hero" / Aventura Dental Arts | foto deslocada 88px do topo para a navegação nunca cruzar a imagem; tag no alto, gradiente no rodapé |
| Campos | Inputs/Sliders/Checkbox do catálogo | slider com trilho de 1px e botão circular, checkbox quadrado desenhado, contador de meses com − / + |
| Quiz | Lists/Buttons | opções com seta que desliza no hover, barra de progresso de 1px |
| Ilustrações | próprias | implante em corte didático (coroa / gengiva / osso) e rosto em linha única |

## Bibliotecas e fotos (licenças)

| Recurso | Licença | Uso |
|---|---|---|
| GSAP 3.15 + ScrollTrigger (cdnjs) | GreenSock "No Charge" (grátis para uso comercial desde 2025) | parallax, texto da banda, botão magnético |
| Lenis 1.3.26 (unpkg) | MIT | rolagem suave |
| Instrument Serif, Hanken Grotesk | OFL (Google Fonts) | tipografia |
| Fotos Unsplash (`images.unsplash.com/photo-1629909613654…`, `…1677026010083…`, `…1593022356769…`, `…1698749778813…`, `…1598256989800…`, `…1588776814546…`) | Unsplash License (comercial, sem atribuição) | consultório, sorriso, implante, espelho, cadeira, procedimento |
| Fotos Pexels (8413334, 5355705, 7800568, 6627447, 14235198) | Pexels License (comercial, sem atribuição) | dentista, Dra. (placeholder), criança, atendimento, retrato |

As fotos são **provisórias e hotlinkadas** dos CDNs. Antes de publicar: trocar pelas fotos reais da
clínica (ou baixar as escolhidas, converter para WebP e colocar em `assets/img/`). Nenhuma foto de
banco pode ser apresentada como paciente real ou depoimento.
