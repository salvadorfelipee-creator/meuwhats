# Prompt para a conversa de publicação do site (colar quando o domínio existir)

Antes de colar, tenha em mãos: (1) o domínio comprado e o acesso ao painel onde ele foi
registrado (Registro.br ou outro), (2) login na Vercel, (3) as fotos reais da Dra. e da clínica,
(4) CNPJ e e-mail de contato da clínica, (5) acesso ao Google Business Profile e ao Search Console
da conta da clínica, (6) IDs do GA4 e do Pixel da Meta, se já existirem.

---

Leia `especita clinica/site/README.md` inteiro. O site da Especitá já está pronto nessa pasta
(estático, gerado por `_build/build_site.py` a partir de `_build/content.py`). Quero publicar.

Dados desta etapa:
- Domínio comprado: [preencher, ex. clinicaespecita.com.br], registrado em [Registro.br / outro].
- Fotos estão em [pasta ou link]. Use: foto da Dra. no hero da home e na página sobre; fachada e
  consultório no bloco de localização; gere também `assets/img/og.png` (1200×630) com foto real.
- CNPJ: [preencher]. E-mail de contato: [preencher]. Convênios aceitos: [lista ou "nenhum"].
- Formação da Dra.: [texto ou "manter placeholder"].
- GA4: [ID ou "criar"]. Pixel Meta: [ID ou "ainda não, empresa em verificação"].

Faça, nesta ordem, sem parar para perguntar o que já está acima:
1. Trocar `SITE["dominio"]` em `content.py` pelo domínio real e preencher os dados acima
   (sobre, privacidade, convênios, geo pelo Google Maps). Rodar o build.
2. Colocar as fotos (comprimidas, < 300 KB cada) nos lugares marcados "(substituir)" e gerar o og.png.
3. Substituir o placeholder do mapa pelo embed do Google Maps da clínica.
4. Adicionar GA4 e, se houver, Pixel + Conversions API; marcar eventos: clique em WhatsApp
   (`a[data-wa-text]`), conclusão de quiz (`.quiz .res.on`), clique em "Como chegar".
5. Criar o projeto na Vercel com Root Directory `especita clinica/site`, framework "Other", sem
   build; adicionar o domínio e me dizer exatamente quais registros DNS criar no registrador
   (A/CNAME) para `@` e `www`.
6. Depois do DNS propagar: testar todas as URLs sem `.html`, o sitemap e o robots; enviar o
   sitemap no Search Console; conferir o Perfil da Empresa no Google com o site novo.
7. Me entregar: lista de URLs no ar, o que ficou pendente e os links de WhatsApp com utm por
   campanha para usar nos anúncios (implante, botox, clareamento, infantil, urgência, avaliação).

Commit e push ao final, como sempre. Não publique preço, "grátis", promoção, promessa de
resultado nem depoimento em nenhuma página (regra do CFO).
