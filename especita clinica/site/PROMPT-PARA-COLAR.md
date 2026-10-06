# Prompt para continuar o site (colar numa conversa nova do Claude Code)

Antes de colar, tenha em mãos o que você já tiver dos itens da seção 6 do `LEIA-ME.md`: endereço final do site e acesso ao
DNS (Hostinger) e à Vercel, fotos reais, CNPJ, e-mail, formação da Dra., convênios, IDs de GA4/Pixel.

---

Leia `especita clinica/CLAUDE.md` e depois `especita clinica/site/LEIA-ME.md` inteiros. O site da Especitá está pronto nessa
pasta (estático, gerado por `_build/build_site.py` a partir de `_build/content.py`; rode com `node serve.cjs`). Quero finalizar e publicar.

Dados desta etapa (apague o que ainda não tenho):
- Endereço final: [ex. novo.clinicaespecita.com ou clinicaespecita.com]. DNS fica na Hostinger; não derrubar o e-mail.
- Fotos reais em [pasta/link]: foto da Dra. no topo da home (`PHOTOS["hero"]`), retrato (`PHOTOS["checkup"]`), consultório (`office`), demais.
- CNPJ: [..]. E-mail: [..]. Formação da Dra.: [..]. Convênios: [lista ou nenhum].
- GA4: [ID]. Pixel Meta: [ID].

Faça, nesta ordem, sem parar para perguntar o que já está acima:
1. Preencher os dados acima em `content.py`/`build_site.py` (sobre, privacidade, convênios, `SITE["dominio"]`, `SITE["geo"]` pelo Google Maps). Rodar o build.
2. Trocar as fotos de banco pelas reais (baixar, converter para WebP < 300 KB em `assets/img/`, ajustar `PHOTOS` para caminhos locais; manter o filtro sépia só se eu pedir).
3. Embed do Google Maps no `local_block()`.
4. Disparar a conversão do Google Ads `AW-16475900720/Ez-5CM30l5MdELCWqbA9` ("WhatsApp - Clique no site") em todo clique em `a[data-wa-text]` e em `[data-pk-cta]`, via gtag direto (não GTM); adicionar GA4 e Pixel, com eventos de clique no WhatsApp e envio do seletor de dentes.
5. Criar `404.html`; hospedar as fontes localmente; conferir `vercel.json`.
6. Criar o projeto na Vercel (Root Directory `especita clinica/site`, framework "Other", sem build) e me dizer exatamente os registros DNS para o endereço escolhido.
7. Depois do DNS: testar todas as URLs sem `.html`, o seletor 3D, o sitemap; rodar Lighthouse mobile e corrigir o que passar de 2,5 s de LCP.
8. Entregar: lista de URLs no ar, links de WhatsApp com utm por campanha (implante, clareamento, infantil, urgência, avaliação, ortodontia, lente) e o que ficou pendente.

Regras: nada de preço, "grátis", promoção, promessa de resultado ou depoimento (CFO); manter o crédito dos modelos 3D (BodyParts3D CC BY-SA)
no rodapé e nos Termos. Commit e push ao final. Não mexa em orçamento, campanha ou conta de anúncios sem eu confirmar.
