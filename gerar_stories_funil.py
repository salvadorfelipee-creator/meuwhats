#!/usr/bin/env python3
"""
Gerador do "funil de 3 Stories" (gancho -> problema/prova -> produto+CTA), no
mesmo padrao visual dos cards de exemplo (media/carrossel_demo_card_*.png):
foto realista + headline bold condensada + linhas de destaque + grade
pontilhada + rodape "Exemplo ilustrativo".

Cobre os 10 temas (5 Cota Certa / 5 Felizcred) pesquisados via Google Trends.
Saida vai para media/stories-review/<conta>/<slug>/card1.png, card2.png, card3.png
-- pasta de REVISAO, nada e publicado/agendado por este script.

Uso:
    python3 gerar_stories_funil.py
"""

import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "media", "stories-assets")
OUT_ROOT = os.path.join(HERE, "media", "stories-review")

BRANDS = {
    "cotacerta": {
        "nome": "CotaCerta",
        "headline": "#0B1E3D",
        "accent_blue": "#0066FF",
        "accent_green": "#25D366",
        "bg": "#F3F1EC",
    },
    "felizcred": {
        "nome": "Felizcred",
        "headline": "#0A1628",
        "accent_blue": "#1e3a5f",
        "accent_green": "#00C853",
        "bg": "#F3F1EC",
    },
}

TEMPLATE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1080px;height:1920px;overflow:hidden;font-family:'Inter',Arial,sans-serif;}
  .canvas{width:1080px;height:1920px;background:__BG__;position:relative;}
  .card{position:absolute;left:36px;top:36px;right:36px;bottom:36px;background:#fff;
    border-radius:44px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(10,20,50,.25);}

  .arc{position:absolute;top:-40px;right:-40px;width:220px;height:220px;background:__BLUE__;
    border-radius:0 0 0 220px;opacity:.95;}

  .brand{position:absolute;left:64px;top:64px;font-family:'Inter',sans-serif;font-weight:800;
    font-size:34px;color:__HEAD__;}
  .brand-line{position:absolute;left:64px;top:118px;width:70px;height:5px;background:__BLUE__;border-radius:3px;}

  .headline{position:absolute;left:64px;top:200px;width:620px;font-family:'Anton',sans-serif;
    font-weight:400;text-transform:uppercase;font-size:__HSIZE__px;line-height:.98;color:__HEAD__;}

  .accent{position:absolute;left:64px;width:96px;height:7px;background:__GREEN__;border-radius:4px;}

  .subtext{position:absolute;left:64px;width:560px;font-size:33px;line-height:1.38;color:__HEAD__;font-weight:500;}

  .box{position:absolute;left:64px;background:__GREEN__;border-radius:20px;padding:22px 28px;max-width:560px;}
  .box .lbl{font-size:26px;color:#ffffffcc;font-weight:600;}
  .box .val{font-family:'Anton',sans-serif;font-size:64px;color:#fff;margin-top:2px;}

  .cta{position:absolute;left:64px;background:__GREEN__;border-radius:18px;padding:26px 34px;
    display:inline-flex;}
  .cta span{font-size:32px;font-weight:800;color:#fff;}

  .footline{position:absolute;left:64px;width:60px;height:4px;background:__BLUE__;border-radius:3px;bottom:150px;z-index:3;}
  .footnote{position:absolute;left:64px;font-size:22px;color:#5b6472;font-weight:500;width:360px;line-height:1.3;bottom:112px;z-index:3;
    text-shadow:0 1px 8px #fff, 0 0 14px #fff;}

  .dots{position:absolute;left:56px;bottom:16px;width:100px;height:60px;z-index:3;
    background-image:radial-gradient(__BLUE__ 4px,transparent 4px);background-size:22px 22px;opacity:.8;}

  .photowrap{position:absolute;right:0;bottom:0;left:__PLEFT__px;overflow:hidden;z-index:1;}
  .photowrap img{width:100%;height:100%;object-fit:cover;object-position:__POS__;
    -webkit-mask-image:linear-gradient(100deg, transparent 0%, #000 26%);
    mask-image:linear-gradient(100deg, transparent 0%, #000 26%);}
</style>
</head>
<body>
  <div class="canvas">
    <div class="card">
      <div class="arc"></div>
      <div class="brand">__BRAND__</div>
      <div class="brand-line"></div>

      <div class="headline" style="top:__HTOP__px;">__HEADLINE__</div>
      <div class="accent" style="top:__ATOP__px;"></div>
      <div class="subtext" style="top:__STOP__px;">__SUBTEXT__</div>

      __EXTRA__

      <div class="footline"></div>
      <div class="footnote">__FOOTNOTE__</div>
      <div class="dots"></div>

      <div class="photowrap" style="top:__PTOP__px;"><img src="__PHOTO__"></div>
    </div>
  </div>
</body>
</html>
"""


def _headline_size(text):
    # Anton e bem condensada; ajusta tamanho pelo comprimento pra nao estourar a largura de 620px
    n = len(text)
    if n <= 18:
        return 96
    if n <= 28:
        return 80
    if n <= 40:
        return 66
    return 56


def _lines(text, width, font_size, char_w_ratio):
    chars_per_line = max(1, int(width / (font_size * char_w_ratio)))
    return max(1, -(-len(text) // chars_per_line))


def render_card(brand_key, photo_path, headline, subtext, footnote,
                 box=None, cta=None, photo_pos="left center", out_path=None):
    b = BRANDS[brand_key]
    hsize = _headline_size(headline)
    htop = 200

    h_lines = _lines(headline, 620, hsize, 0.60)
    headline_bottom = htop + int(hsize * 0.98 * h_lines) + 14
    atop = headline_bottom + 24
    stop = atop + 7 + 34

    s_lines = _lines(subtext, 560, 33, 0.52)
    subtext_bottom = stop + int(33 * 1.38 * s_lines)

    extra = ""
    content_bottom = subtext_bottom
    if box:
        box_top = content_bottom + 44
        extra += (
            f'<div class="box" style="top:{box_top}px;">'
            f'<div class="lbl">{box["label"]}</div><div class="val">{box["val"]}</div></div>'
        )
        content_bottom = box_top + 150
    if cta:
        cta_top = content_bottom + 40
        extra += f'<div class="cta" style="top:{cta_top}px;"><span>{cta}</span></div>'
        content_bottom = cta_top + 90

    ptop = max(560, min(1300, content_bottom + 60))

    html = (
        TEMPLATE
        .replace("__BG__", b["bg"])
        .replace("__BLUE__", b["accent_blue"])
        .replace("__GREEN__", b["accent_green"])
        .replace("__HEAD__", b["headline"])
        .replace("__BRAND__", b["nome"])
        .replace("__HSIZE__", str(hsize))
        .replace("__HTOP__", str(htop))
        .replace("__ATOP__", str(atop))
        .replace("__STOP__", str(stop))
        .replace("__HEADLINE__", headline)
        .replace("__SUBTEXT__", subtext)
        .replace("__FOOTNOTE__", footnote)
        .replace("__EXTRA__", extra)
        .replace("__PLEFT__", "248")
        .replace("__PTOP__", str(ptop))
        .replace("__POS__", photo_pos)
        .replace("__PHOTO__", "file:///" + os.path.abspath(photo_path).replace("\\", "/"))
    )

    html_path = out_path.replace(".png", ".html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1920})
        page.goto("file:///" + os.path.abspath(html_path).replace("\\", "/"))
        page.wait_for_timeout(200)
        page.screenshot(path=out_path)
        browser.close()
    os.remove(html_path)
    print("ok:", out_path)


# ─── Temas (5 Cota Certa + 5 Felizcred), cada um com o funil de 3 cards ─────

TEMAS = [
    # ===================== COTA CERTA =====================
    {
        "conta": "cotacerta", "slug": "motoboy-dit",
        "foto": "cotacerta_1_motoboy_dit.jpeg", "photo_pos": "center 30%",
        "cards": [
            dict(headline="E SE VOCÊ PRECISAR PARAR?",
                 subtext="Motoboy e entregador de app vivem da própria força pra trabalhar.",
                 footnote="Exemplo ilustrativo."),
            dict(headline="A LEI JÁ AJUDA. MAS TEM UM BURACO.",
                 subtext="O app é obrigado a dar seguro de acidente. Só que ele não cobre sua renda enquanto você não pode voltar a rodar.",
                 footnote="Lei 14.297/2022 — cobertura do app é só acidente, não renda."),
            dict(headline="DIÁRIA POR INCAPACIDADE TEMPORÁRIA",
                 subtext="Um valor por dia parado, por acidente ou doença, enquanto sua renda não volta.",
                 cta="Fale com a CotaCerta.",
                 footnote="Exemplo ilustrativo. Sujeito a análise."),
        ],
    },
    {
        "conta": "cotacerta", "slug": "motorista-app",
        "foto": "cotacerta_2_motorista_app.jpeg", "photo_pos": "center 20%",
        "cards": [
            dict(headline="RODOU O DIA TODO. E SE DER ALGO?",
                 subtext="Motorista de app passa o dia rodando — o carro é ferramenta de trabalho, não só bem pessoal.",
                 footnote="Exemplo ilustrativo."),
            dict(headline="SEGURO COMUM NEM SEMPRE COBRE",
                 subtext="Muita apólice de uso particular recusa sinistro quando descobre que o carro roda por aplicativo.",
                 footnote="Confirme sempre o uso declarado na apólice."),
            dict(headline="PROTEÇÃO PENSADA PRA QUEM RODA",
                 subtext="Cobertura com uso por aplicativo aceito de verdade, sem letra miúda te pegando na hora do aperto.",
                 cta="Fale com a CotaCerta.",
                 footnote="Exemplo ilustrativo. Condições conforme análise e apólice contratada."),
        ],
    },
    {
        "conta": "cotacerta", "slug": "rc-profissional",
        "foto": "cotacerta_3_rc_profissional.jpeg", "photo_pos": "center 25%",
        "cards": [
            dict(headline="UM ERRO. UM CLIENTE BRAVO.",
                 subtext="Prestador de serviço e profissional liberal vivem da própria reputação.",
                 footnote="Exemplo ilustrativo."),
            dict(headline="PROCESSO NÃO AVISA ANTES",
                 subtext="Uma reclamação por falha ou erro no serviço pode virar ação judicial — mesmo quando você fez o seu melhor.",
                 footnote="Defesa judicial costuma ser a maior parte do custo, mesmo ganhando a causa."),
            dict(headline="RC PROFISSIONAL",
                 subtext="Cobre defesa judicial e indenização em caso de erro, omissão ou falha na prestação do serviço.",
                 cta="Fale com a CotaCerta.",
                 footnote="Exemplo ilustrativo. Coberturas variam por profissão e apólice."),
        ],
    },
    {
        "conta": "cotacerta", "slug": "seguro-vida-mei",
        "foto": "cotacerta_4_seguro_mei.jpeg", "photo_pos": "center 20%",
        "cards": [
            dict(headline="SEM PATRÃO, SEM RENDA GARANTIDA",
                 subtext="MEI e autônomo não têm auxílio-doença automático como quem tem carteira assinada.",
                 footnote="Exemplo ilustrativo."),
            dict(headline="SE PARAR DE TRABALHAR, PARA DE ENTRAR DINHEIRO",
                 subtext="Um imprevisto de saúde não avisa — e as contas do negócio continuam chegando do mesmo jeito.",
                 footnote="Situação ilustrativa, baseada em relatos comuns de autônomos."),
            dict(headline="SEGURO DE VIDA COM DIT",
                 subtext="Diária por incapacidade temporária: um valor por dia parado, pra segurar as pontas.",
                 cta="Fale com a CotaCerta.",
                 footnote="Exemplo ilustrativo. Consulte carências, limites e exclusões."),
        ],
    },
    {
        "conta": "cotacerta", "slug": "seguro-auto",
        "foto": "cotacerta_5_seguro_auto.jpeg", "photo_pos": "center 35%",
        "cards": [
            dict(headline="TODO CARRO TEM UMA HISTÓRIA",
                 subtext="E toda história tem um dia ruim — batida, roubo, vidro quebrado.",
                 footnote="Exemplo ilustrativo."),
            dict(headline="A DIFERENÇA APARECE NA HORA DO SINISTRO",
                 subtext="Franquia alta, carro reserva que não sai, assistência que não atende — o preço baixo às vezes cobra depois.",
                 footnote="Compare sempre coberturas, não só o valor da apólice."),
            dict(headline="SEGURO AUTO QUE FUNCIONA QUANDO PRECISA",
                 subtext="Colisão, roubo, furto, carro reserva e assistência 24h de verdade.",
                 cta="Fale com a CotaCerta.",
                 footnote="Exemplo ilustrativo. Coberturas conforme apólice contratada."),
        ],
    },
    # ===================== FELIZCRED =====================
    {
        "conta": "felizcred", "slug": "consignado-nome-sujo",
        "foto": "felizcred_1_nome_sujo.jpeg", "photo_pos": "center 20%",
        "cards": [
            dict(headline="NOME SUJO? ACHA QUE NÃO TEM CRÉDITO?",
                 subtext="Muita gente com carteira assinada desiste de pedir empréstimo achando que tá fora.",
                 footnote="Exemplo ilustrativo."),
            dict(headline="ESSE MITO CUSTA CARO",
                 subtext="Consignado CLT não exige nome limpo — a garantia é o seu vínculo empregatício, não o seu score.",
                 footnote="Regra vale pra quem tem carteira assinada, incluindo doméstico e rural."),
            dict(headline="CONSIGNADO CLT MESMO COM NOME SUJO",
                 subtext="Desconto direto na folha, análise pelo vínculo de trabalho — simula sem compromisso.",
                 cta="Simular no WhatsApp",
                 footnote="Exemplo ilustrativo. Sujeito a análise e às regras vigentes."),
        ],
    },
    {
        "conta": "felizcred", "slug": "portabilidade-consignado",
        "foto": "felizcred_2_portabilidade.jpeg", "photo_pos": "center 15%",
        "cards": [
            dict(headline="PAGANDO JUROS ALTOS DEMAIS?",
                 subtext="Se você já tem consignado CLT, talvez esteja pagando mais do que devia.",
                 footnote="Exemplo ilustrativo."),
            dict(headline="VOCÊ PODE TROCAR DE BANCO",
                 subtext="A portabilidade é direito seu — nenhuma instituição pode te proibir de migrar pra uma taxa melhor.",
                 footnote="Direito garantido por norma vigente do crédito do trabalhador."),
            dict(headline="PORTABILIDADE COM TROCO",
                 subtext="Compare sua proposta atual e veja se dá pra pagar menos por mês, ou receber troco.",
                 cta="Simular no WhatsApp",
                 footnote="Exemplo ilustrativo. Condições dependem de análise de cada instituição."),
        ],
    },
    {
        "conta": "felizcred", "slug": "cet-nao-so-taxa",
        "foto": "felizcred_3_cet_comparacao.jpeg", "photo_pos": "center 15%",
        "cards": [
            dict(headline="DUAS PROPOSTAS. MESMA TAXA. PREÇO DIFERENTE.",
                 subtext="Já reparou que isso é possível? Não é golpe — é o CET.",
                 footnote="Exemplo ilustrativo."),
            dict(headline="A TAXA SOZINHA NÃO CONTA A HISTÓRIA TODA",
                 subtext="Seguro, tarifa e IOF embutidos mudam o custo final — e o consignado CLT não tem teto de juros.",
                 footnote="Compare sempre pelo Custo Efetivo Total (CET), não só a taxa anunciada."),
            dict(headline="A GENTE COMPARA POR VOCÊ",
                 subtext="Simulação clara, mostrando o CET de verdade antes de você assinar qualquer coisa.",
                 cta="Simular no WhatsApp",
                 footnote="Exemplo ilustrativo. Sujeito a análise de crédito."),
        ],
    },
    {
        "conta": "felizcred", "slug": "domestico-rural-direito",
        "foto": "felizcred_4_domestico_rural.jpeg", "photo_pos": "center 15%",
        "cards": [
            dict(headline="TRABALHADOR DOMÉSTICO TAMBÉM TEM DIREITO",
                 subtext="E trabalhador rural também. Muita gente com carteira assinada não sabe disso.",
                 footnote="Exemplo ilustrativo."),
            dict(headline="A REGRA É SIMPLES",
                 subtext="Carteira assinada + alguns meses de vínculo já dão acesso ao consignado CLT, com desconto direto na folha.",
                 footnote="Requisitos de tempo de vínculo variam por instituição."),
            dict(headline="VEM CONVERSAR COM A FELIZCRED",
                 subtext="A gente te explica se você já tem direito e simula sem compromisso.",
                 cta="Simular no WhatsApp",
                 footnote="Exemplo ilustrativo. Sujeito a análise e vínculo empregatício."),
        ],
    },
    {
        "conta": "felizcred", "slug": "fgts-regras-2026",
        "foto": "felizcred_5_fgts_2026.jpeg", "photo_pos": "center 20%",
        "cards": [
            dict(headline="AS REGRAS DO SEU FGTS MUDARAM",
                 subtext="E boa parte dos trabalhadores CLT ainda não sabe o que isso significa no bolso.",
                 footnote="Exemplo ilustrativo."),
            dict(headline="MARGEM MAIOR, MAIS OPÇÃO NA MÃO",
                 subtext="Margem de até 35% do salário líquido e FGTS liberado entram na conta na hora de decidir pedir crédito ou não.",
                 footnote="Confira as condições vigentes antes de contratar."),
            dict(headline="ENTENDA O QUE MUDOU PRA VOCÊ",
                 subtext="A gente te explica as regras novas e simula o que cabe no seu salário.",
                 cta="Simular no WhatsApp",
                 footnote="Exemplo ilustrativo. Regras sujeitas a atualização — confirme condições vigentes."),
        ],
    },
]


if __name__ == "__main__":
    for tema in TEMAS:
        conta = tema["conta"]
        slug = tema["slug"]
        foto = os.path.join(ASSETS, tema["foto"])
        pos = tema.get("photo_pos", "center center")
        out_dir = os.path.join(OUT_ROOT, conta, slug)
        os.makedirs(out_dir, exist_ok=True)
        print(f"\n=== {conta}/{slug} ===")
        for i, card in enumerate(tema["cards"], start=1):
            out_path = os.path.join(out_dir, f"card{i}.png")
            render_card(
                conta, foto,
                headline=card["headline"],
                subtext=card["subtext"],
                footnote=card["footnote"],
                box=card.get("box"),
                cta=card.get("cta"),
                photo_pos=pos,
                out_path=out_path,
            )
    print("\n=== TUDO PRONTO — revise em media/stories-review/ ===")
