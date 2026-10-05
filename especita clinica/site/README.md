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

## Decisões de design

- Verde-menta profundo como marca, areia clara como calor, branco como superfície. Títulos em
  Bricolage Grotesque, texto em Instrument Sans (Google Fonts). Mesma identidade usada no painel e
  no material da clínica, para a Dra. reconhecer tudo como uma coisa só.
- Uma ferramenta interativa por página de serviço, sempre ilustrativa e com aviso, porque
  simular o rosto ou o sorriso real do visitante esbarra em promessa de resultado (CFO) e em
  dado sensível (LGPD). Quando a clínica tiver casos com termo de consentimento, o componente
  antes/depois aceita fotos reais no lugar das ilustrações.
- Sem formulário de e-mail: tudo vai para o WhatsApp, que é onde a recepção atende e onde o
  painel mede.
