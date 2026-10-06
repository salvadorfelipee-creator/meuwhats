# Site da Especitá Odontologia e Estética — projeto completo

Comece por aqui. Estado em **06/10/2026**. O site está pronto para uso local e para publicar; faltam
os itens da seção 6 (a maioria depende de dados e acessos da clínica).

## 1. O que é

Site estático (HTML, CSS e JS puros, sem framework e sem build obrigatório) da clínica da Dra. Catiucia L. Riffel
(CRO-SC 14067), Brusque/SC. 16 páginas: home, 11 páginas de serviço (cada uma serve de página de anúncio e de SEO),
a Dra., contato, privacidade e termos. Todo contato vai para o WhatsApp (+55 47 99778-9519) com mensagem pré-preenchida.

| Página | Arquivo | Ferramenta interativa |
|---|---|---|
| Início | `index.html` | hero com cartão de foto + 2 mensagens, serviços em painéis, passos, **seletor 3D de dentes** |
| Implante dentário | `implante-dentario.html` | seletor 3D (dente faltando) |
| Dente quebrado | `dente-quebrado.html` | seletor 3D |
| Dor de dente | `dor-de-dente.html` | seletor 3D + triagem de 2 perguntas |
| Lente de contato dental | `lente-de-contato-dental.html` | seletor 3D |
| Ortodontia / Alinhador invisível | `ortodontia.html`, `alinhador-invisivel.html` | comparador fixo x alinhador |
| Odontopediatria | `odontopediatria.html` | calculadora "quando levar o bebê" |
| Clareamento dental | `clareamento-dental.html` | escala de tons (ilustrativa) |
| Harmonização facial | `harmonizacao-facial.html` | ilustração em linha de rosto com linhas de expressão |
| Tratamento geral e família / Avaliação | `tratamento-odontologico.html`, `dentista-em-brusque.html` | — |
| A Dra. / Contato / Privacidade / Termos | `sobre.html`, `contato.html`, `privacidade.html`, `termos.html` | — |

Também: `sitemap.xml`, `robots.txt`, `llms.txt` (buscadores de IA), `vercel.json` (URLs limpas e cache), dados
estruturados (Dentist, MedicalProcedure, FAQPage, Breadcrumb) em cada página.

## 2. Como rodar e editar

```bash
cd "especita clinica/site"
node serve.cjs            # abre em http://localhost:4174 (Node 18+, sem instalar nada)
```

Para editar textos, serviços, endereço, horário: `_build/content.py`. Estrutura e componentes: `_build/build_site.py`.
Estilo: `assets/css/site.css`. Comportamento e efeitos: `assets/js/site.js`. Seletor 3D: `assets/js/tooth-picker.js`.
**Nunca edite os `.html` gerados à mão.** Depois de qualquer mudança:

```bash
cd "especita clinica/site/_build" && python build_site.py
```

Para acrescentar um serviço: copie um bloco `dict(...)` em `SERVICOS` (content.py), adicione a entrada em `HERO` (build_site.py)
e rode o build; página, sitemap, llms.txt e rodapé se atualizam.

**Efeitos de rolagem não aparecem?** O site obedece à opção "reduzir animações" do Windows. Abra com `?efeitos=1`
(`?efeitos=0` desfaz).

## 3. Identidade visual

- Cores (Pantone enviadas pelo Salvador): Demitasse `#3E322A`, Coffee Liqueur `#6B523A`, Dijon `#97784F`, Warm Sand `#C4B196`, mais branco e `#F4EFE8`.
- Fontes: Newsreader 500 (títulos) e Hanken Grotesk (texto), Google Fonts. Fotos em sépia por CSS (`--photo`) até chegarem as reais.
- Miolo de 1200px centralizado (`--gutter`). Referências estudadas: Aventura Dental Arts (coreografia de rolagem) e o topo do odontolife.lovable.app (cartão de foto com mensagens flutuantes, só o estilo).
- Efeitos: GSAP + ScrollTrigger e Lenis (CDN). Classe `fx` no `<html>` só em tela larga e sem "reduzir animações". No celular tudo empilha estático.

## 4. Regras de conteúdo (não quebrar)

- CFO (Res. 196/2019 e 271/2025): **nada de preço, parcelamento, "grátis", promoção, garantia de resultado ou depoimento**; antes/depois só com termo de consentimento e fora de anúncio pago. Nome + CRO em todas as páginas (já está). Valores só na conversa de WhatsApp.
- As ferramentas são **ilustrativas** e dizem isso na tela. Não simulam o rosto ou o sorriso do visitante (promessa de resultado e dado sensível pela LGPD).
- Modelos 3D dos dentes: BodyParts3D © DBCLS (CC BY-SA 2.1 Japão) via Dental Scope (MIT). **O crédito no rodapé, nos Termos e em `assets/models/CREDITS.md` precisa ficar.**
- Fotos de banco são provisórias e não podem ser apresentadas como paciente real.
- Decidido e **cancelado** pelo Salvador: rosto 3D realista para harmonização (opção pesquisada: cabeça LeePerrySmith do three.js, CC BY 3.0).

## 5. Publicar (Vercel, projeto próprio)

1. Vercel → novo projeto → Root Directory `especita clinica/site`, framework "Other", sem build command.
2. **Decidir o endereço.** Em 06/10 o site atual da clínica é WordPress na Hostinger em `clinicaespecita.com` (e-mail também na Hostinger). Duas rotas: (a) subdomínio de teste (`novo.clinicaespecita.com`, só um CNAME, sem risco para o site e o e-mail atuais); (b) trocar o site principal (A/CNAME de `@` e `www` para a Vercel, **mantendo os registros MX do e-mail**).
3. `SITE["dominio"]` em `content.py` está em `https://clinicaespecita.com`; se o endereço final for outro, trocar e rodar o build (canonical, sitemap e llms.txt usam ele).
4. Depois do DNS: testar todas as URLs, enviar `sitemap.xml` no Search Console, conferir o Perfil da Empresa no Google.

Prompt pronto para a conversa de publicação: `PROMPT-PARA-COLAR.md`.

## 6. O que falta (com responsável)

| # | Item | Quem | Observação |
|---|---|---|---|
| 1 | Endereço final do site e acesso ao DNS (Hostinger) e à Vercel | Salvador | ver seção 5; não derrubar o e-mail |
| 2 | **Fotos reais** da Dra. (hero, retrato, página A Dra.), fachada, recepção, consultório | Clínica | hoje são fotos de banco, hotlinkadas do Unsplash/Pexels; formato retrato 1200×1600 e paisagem 1600×1000, < 300 KB, e baixar para `assets/img/` |
| 3 | CNPJ ("Especita Odontologia e Estetica Ltda"), e-mail de contato, formação da Dra., convênios aceitos | Clínica | marcados como `[preencher]` em privacidade, sobre e tratamento geral |
| 4 | Embed do Google Maps e coordenadas exatas | Salvador/Claude | placeholder em `local_block()`; `SITE["geo"]` é aproximado |
| 5 | **Rastreio de conversão**: Google Ads tem a conversão "WhatsApp - Clique no site" (`AW-16475900720/Ez-5CM30l5MdELCWqbA9`) disparada hoje por código no WordPress; o site novo precisa disparar o mesmo evento nos botões `a[data-wa-text]` | Salvador/Claude | o container GTM-5W2C495R é de outra conta; usar gtag direto |
| 6 | GA4 e Pixel da Meta (+ API de Conversões) | Salvador | eventos sugeridos: clique no WhatsApp, envio do seletor (`[data-pk-cta]`), quiz concluído |
| 7 | Apontar os anúncios do Google Ads para as páginas por serviço (hoje a URL final é a home) e trocar o link da bio do Instagram por links com `?utm_source=...&utm_campaign=...` | Salvador | a origem chega no WhatsApp e no painel |
| 8 | Revisão de todo o texto pela Dra. (CFO): "Biossegurança em cada consulta", "10+ anos", FAQs de harmonização | Clínica | o texto da harmonização tem uma frase cautelosa sobre regulamentação; a pendência do TRF1 foi resolvida em 05/10, pode ser simplificada |
| 9 | Página 404, imagens em WebP locais, fontes hospedadas no próprio site, SRI nos scripts de CDN | Claude | melhorias de qualidade; nada bloqueia a publicação |
| 10 | Testes que **não** foram feitos: 3D em placa de vídeo real, Safari/iPhone, Lighthouse mobile, leitor de tela | Claude/Salvador | testes foram em Chromium com renderização por software |
| 11 | Páginas legais definitivas e link da política de privacidade do app Meta (hoje no GitHub Pages `especitaodonto`) apontando para o site | Salvador | |

## 7. Projeto maior (onde isto se encaixa)

Tudo da Especitá vive em `especita clinica/` (repositório `meuwhatsapp`):
- `CLAUDE.md` — contexto geral, contas de anúncio, decisões e histórico (leia antes de agir).
- `plano-midia-2026-10/` — auditoria, públicos, testes, criativos, fluxos de WhatsApp (`06-FLUXOS-WHATSAPP.html`), Google Ads.
- `site/` — este projeto.
- O painel de atendimento é outro repositório: `whatsapp especita/` (spec do redesign em `docs/redesign/`).

## 8. Histórico das versões

v1 estrutura e conteúdo (rejeitada por visual genérico) → v2 direção editorial → v3 componentes → v4 coreografia de rolagem do Aventura e paleta Pantone → v5 coreografia em todas as páginas e seletor 3D → v6 novo topo da home → v7 miolo de 1200px, barra de progresso e modo `?efeitos=1`. Detalhes técnicos de cada passada em `README.md`.
