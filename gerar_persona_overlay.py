#!/usr/bin/env python3
"""
Carimba texto (headline + corpo + rodape [+ botao CTA]) em cima de um fundo ja
gerado (foto + painel de marca em branco, sem texto nenhum, feito no Higgsfield
com nano_banana_pro). Ideia: gerar 1 fundo por persona no Higgsfield (caro) e
reaproveitar pros 5 cards da mesma persona so trocando o texto (gratis/local).

Posicoes em % da imagem, nao em px fixo -- funciona mesmo se o fundo gerado
variar um pouco de resolucao/proporcao entre personas.

Uso:
    python3 gerar_persona_overlay.py
"""

import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
BACKGROUNDS = os.path.join(HERE, "media", "personas-backgrounds")
OUT_ROOT = os.path.join(HERE, "media", "stories-review-personas")

NAVY = "#0B1E3D"
GREEN = "#25D366"

TEMPLATE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1080px;height:1920px;overflow:hidden;font-family:'Inter',Arial,sans-serif;}
  .canvas{width:1080px;height:1920px;position:relative;}
  .canvas img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}

  .headline{position:absolute;left:13%;top:__HTOP__%;width:52%;font-family:'Anton',sans-serif;
    font-weight:400;text-transform:uppercase;font-size:__HSIZE__px;line-height:1.0;color:__NAVY__;}

  .accent{position:absolute;left:13%;width:9%;min-width:80px;height:7px;background:__GREEN__;
    border-radius:4px;top:__ATOP__%;}

  .subtext{position:absolute;left:13%;top:__STOP__%;width:47%;font-size:31px;line-height:1.38;
    color:__NAVY__;font-weight:500;}

  __EXTRA__

  .footnote{position:absolute;left:13%;top:83%;font-size:21px;color:#5b6472;font-weight:600;
    width:34%;line-height:1.3;}
</style>
</head>
<body>
  <div class="canvas">
    <img class="bg" src="__BG__">
    <div class="headline" style="top:__HTOP__%;">__HEADLINE__</div>
    <div class="accent" style="top:__ATOP__%;"></div>
    <div class="subtext" style="top:__STOP__%;">__SUBTEXT__</div>
    __EXTRA__
    <div class="footnote">__FOOTNOTE__</div>
  </div>
</body>
</html>
"""


def _headline_size(text):
    n = len(text)
    if n <= 18:
        return 90
    if n <= 28:
        return 74
    if n <= 42:
        return 60
    return 50


def render_overlay(bg_path, headline, subtext, footnote, cta=None, out_path=None):
    hsize = _headline_size(headline)
    htop = 19.0
    h_lines = max(1, -(-len(headline) // 15))
    atop = htop + (hsize * 1.0 * h_lines) / 1920 * 100 + 2.2
    stop = atop + 1.0

    extra = ""
    if cta:
        cta_top = stop + 12.0
        extra = (
            f'<div style="position:absolute;left:13%;top:{cta_top}%;background:{GREEN};'
            f'border-radius:18px;padding:24px 32px;display:inline-flex;">'
            f'<span style="font-size:30px;font-weight:800;color:#fff;">{cta}</span></div>'
        )

    html = (
        TEMPLATE
        .replace("__NAVY__", NAVY)
        .replace("__GREEN__", GREEN)
        .replace("__HSIZE__", str(hsize))
        .replace("__HTOP__", f"{htop}")
        .replace("__ATOP__", f"{atop}")
        .replace("__STOP__", f"{stop}")
        .replace("__HEADLINE__", headline)
        .replace("__SUBTEXT__", subtext)
        .replace("__FOOTNOTE__", footnote)
        .replace("__EXTRA__", extra)
        .replace("__BG__", "file:///" + os.path.abspath(bg_path).replace("\\", "/"))
    )

    html_path = out_path.replace(".png", ".html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1920})
        page.goto("file:///" + os.path.abspath(html_path).replace("\\", "/"))
        page.wait_for_timeout(150)
        page.screenshot(path=out_path)
        browser.close()
    os.remove(html_path)
    print("ok:", out_path)


CARD1 = dict(
    headline="VOCÊ TRABALHA POR CONTA PRÓPRIA",
    subtext="Mas sua renda continua se ela parar?",
    footnote="Exemplo ilustrativo.",
)
CARD5 = dict(
    headline="SUA RENDA MERECE UM PLANO B",
    subtext="Quer entender qual proteção combina com sua realidade?",
    cta="Fale com a CotaCerta.",
    footnote="A disponibilidade depende da análise e das condições do produto.",
)

def persona_cotacerta(bg, nome_idade, bio_renda, problema, avaliar):
    return {
        "bg": bg,
        "cards": [
            CARD1,
            dict(headline=nome_idade, subtext=bio_renda, footnote="Exemplo ilustrativo."),
            dict(headline=problema[0], subtext=problema[1], footnote="Exemplo ilustrativo."),
            dict(headline="O QUE AVALIAR", subtext=avaliar,
                 footnote="Consulte carências, limites e exclusões."),
            CARD5,
        ],
    }


COTACERTA = {
    "diego": persona_cotacerta(
        "diego.png", "DIEGO, 38 ANOS",
        "Motorista de aplicativo, casado, duas filhas de 6 e 10 anos. Renda mensal simulada: R$ 6.200.",
        ("O CARRO É FERRAMENTA DE TRABALHO",
         "A renda depende de poder dirigir. As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "Seguro auto declarado para aplicativo; DIT; proteção para terceiros. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "camila": persona_cotacerta(
        "camila.png", "CAMILA, 27 ANOS",
        "Manicure autônoma, mãe solo de uma filha de 5 anos. Renda mensal simulada: R$ 3.900.",
        ("A RENDA PARA QUANDO NÃO DÁ PRA ATENDER",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "DIT; seguro de vida; proteção para equipamentos do espaço de atendimento. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "joao": persona_cotacerta(
        "joao.png", "JOÃO, 44 ANOS",
        "Eletricista autônomo, casado, três filhos adolescentes. Renda mensal simulada: R$ 7.500.",
        ("UM ACIDENTE PODE AFETAR RENDA E CASA",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "DIT; RC profissional; seguro de vida; ferramentas protegidas. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "priscila": persona_cotacerta(
        "priscila.png", "PRISCILA, 35 ANOS",
        "Encanadora, casada, mãe de um filho de 8 anos. Renda mensal simulada: R$ 5.600.",
        ("O TRABALHO EXIGE DESLOCAMENTO E ESFORÇO",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "DIT; RC profissional; seguro auto se usar veículo no trabalho. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "marcelo": persona_cotacerta(
        "marcelo.png", "MARCELO, 32 ANOS",
        "Fotógrafo de eventos, vive com companheira e ajuda os pais. Renda mensal simulada: R$ 8.000.",
        ("DOENÇA PODE CANCELAR TRABALHOS AGENDADOS",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "DIT; seguro para equipamentos; RC profissional. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "larissa": persona_cotacerta(
        "larissa.png", "LARISSA, 26 ANOS",
        "Designer freelancer, solteira, ajuda financeiramente a mãe. Renda mensal simulada: R$ 5.200.",
        ("SAÚDE PODE INTERROMPER ENTREGAS E CONTRATOS",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "DIT; RC profissional; seguro para notebook e equipamentos. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "andre": persona_cotacerta(
        "andre.png", "ANDRÉ, 31 ANOS",
        "Barbeiro, casado, pai de dois filhos. Renda mensal simulada: R$ 5.000.",
        ("SEM TRABALHAR, NÃO HÁ FATURAMENTO",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "DIT; seguro para salão; RC geral e profissional conforme atividade. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "bianca": persona_cotacerta(
        "bianca.png", "BIANCA, 30 ANOS",
        "Vendedora de roupas online, casada, mãe de uma bebê. Renda mensal simulada: R$ 4.300.",
        ("ESTOQUE E RENDA VULNERÁVEIS A IMPREVISTOS",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "Empresa Essencial para estoque e equipamentos; DIT para renda pessoal. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "sonia": persona_cotacerta(
        "sonia.png", "SÔNIA, 48 ANOS",
        "Diarista autônoma, divorciada, sustenta um filho universitário. Renda mensal simulada: R$ 3.600.",
        ("UMA LESÃO PODE IMPEDIR SEMANAS DE TRABALHO",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "DIT; seguro de vida; acidente pessoal. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "carlos": persona_cotacerta(
        "carlos.png", "CARLOS, 42 ANOS",
        "Pedreiro, casado, pai de quatro filhos. Renda mensal simulada: R$ 6.800.",
        ("ACIDENTE PODE SUSPENDER A RENDA NA HORA",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "DIT; seguro de vida; RC profissional quando aplicável. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "juliana": persona_cotacerta(
        "juliana.png", "JULIANA, 36 ANOS",
        "Pintora residencial, casada, mãe de dois filhos. Renda mensal simulada: R$ 5.400.",
        ("A ATIVIDADE DEPENDE DA CAPACIDADE FÍSICA",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "DIT; seguro de vida; proteção para ferramentas. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "felipe": persona_cotacerta(
        "felipe.png", "FELIPE, 33 ANOS",
        "Professor particular, solteiro, ajuda os avós. Renda mensal simulada: R$ 4.700.",
        ("AULAS CANCELADAS SÃO RENDA PERDIDA",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "DIT; RC profissional; seguro de vida. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "renata": persona_cotacerta(
        "renata.png", "RENATA, 29 ANOS",
        "Personal trainer, casada, responsável por parte da renda da casa. Renda mensal simulada: R$ 6.500.",
        ("LESÃO PODE IMPEDIR AULAS PRESENCIAIS",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "DIT; RC profissional; acidente pessoal. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "aline": persona_cotacerta(
        "aline.png", "ALINE, 34 ANOS",
        "Nutricionista, casada, mãe de um filho. Renda mensal simulada: R$ 7.200.",
        ("A PROTEÇÃO PRECISA CONSIDERAR O SERVIÇO",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "RC profissional; DIT; seguro de vida. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "marina": persona_cotacerta(
        "marina.png", "MARINA, 41 ANOS",
        "Psicóloga autônoma, divorciada, mãe de uma adolescente. Renda mensal simulada: R$ 8.500.",
        ("A RENDA DEPENDE DA AGENDA DE ATENDIMENTOS",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "RC profissional; DIT; seguro de vida. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "eduardo": persona_cotacerta(
        "eduardo.png", "EDUARDO, 46 ANOS",
        "Contador, casado, dois filhos. Renda mensal simulada: R$ 10.000.",
        ("ERRO PROFISSIONAL E AFASTAMENTO SÃO RISCOS DIFERENTES",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "RC profissional para reclamações; DIT para afastamento. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "patricia": persona_cotacerta(
        "patricia.png", "PATRÍCIA, 39 ANOS",
        "Advogada autônoma, casada, mãe de dois filhos. Renda mensal simulada: R$ 12.000.",
        ("ERRO NO SERVIÇO E INCAPACIDADE SÃO RISCOS DISTINTOS",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "RC profissional; DIT; seguro de vida. A disponibilidade depende da análise e das condições contratadas.",
    ),
    "gustavo": persona_cotacerta(
        "gustavo.png", "GUSTAVO, 37 ANOS",
        "Arquiteto, vive com companheiro e apoia um irmão. Renda mensal simulada: R$ 11.500.",
        ("PROJETOS GERAM RESPONSABILIDADE, E A RENDA DEPENDE DA ATUAÇÃO",
         "As contas continuam chegando, mesmo quando o trabalho precisa parar."),
        "RC profissional; DIT; seguro para equipamentos. A disponibilidade depende da análise e das condições contratadas.",
    ),
}

FZ_CARD1 = dict(
    headline="VOCÊ TEM CARTEIRA ASSINADA",
    subtext="Mas sabe todo crédito que isso já te dá direito?",
    footnote="Exemplo ilustrativo.",
)
FZ_CARD5 = dict(
    headline="SEU CRÉDITO CERTO TÁ AQUI",
    subtext="Quer simular sem compromisso e sem pesquisar sozinho?",
    cta="Simular no WhatsApp",
    footnote="Sujeito a análise e às condições vigentes.",
)


def persona_felizcred(bg, nome_idade, bio, problema, avaliar):
    return {
        "bg": bg,
        "cards": [
            FZ_CARD1,
            dict(headline=nome_idade, subtext=bio, footnote="Exemplo ilustrativo."),
            dict(headline=problema[0], subtext=problema[1], footnote="Exemplo ilustrativo."),
            dict(headline="O QUE AVALIAR", subtext=avaliar,
                 footnote="Sujeito a análise e vínculo empregatício."),
            FZ_CARD5,
        ],
    }


FELIZCRED = {
    "marta": persona_felizcred(
        "felizcred_marta.png", "MARTA, 34 ANOS",
        "Vendedora CLT numa loja de roupas, 2 anos de carteira assinada.",
        ("NOME SUJO NÃO IMPEDE O CONSIGNADO CLT",
         "A garantia é o vínculo empregatício, não o score de crédito."),
        "Consignado CLT com desconto direto na folha; análise pelo vínculo, não pelo nome sujo.",
    ),
    "roberto": persona_felizcred(
        "felizcred_roberto.png", "ROBERTO, 41 ANOS",
        "Motorista CLT de uma empresa de transporte, já tem consignado ativo.",
        ("CONTRATO ANTIGO COM JUROS ALTOS PODE SER TROCADO",
         "A portabilidade é direito seu — nenhum banco pode te proibir de migrar."),
        "Portabilidade do consignado CLT; comparação de propostas pelo CET, não só a taxa.",
    ),
    "fernanda": persona_felizcred(
        "felizcred_fernanda.png", "FERNANDA, 29 ANOS",
        "Auxiliar administrativa CLT, comparando duas propostas de empréstimo.",
        ("MESMA TAXA, CUSTO FINAL DIFERENTE",
         "Seguro, tarifa e IOF embutidos mudam o valor real da parcela."),
        "Comparar sempre pelo CET (Custo Efetivo Total); consignado CLT não tem teto de juros.",
    ),
    "ana": persona_felizcred(
        "felizcred_ana.png", "ANA, 52 ANOS",
        "Empregada doméstica registrada, não sabia que tinha direito ao consignado.",
        ("QUEM TEM CARTEIRA ASSINADA EM CASA TAMBÉM TEM DIREITO",
         "Doméstico e rural entram na mesma regra do consignado CLT."),
        "Tempo mínimo de vínculo; desconto direto na folha; sem exigência de nome limpo.",
    ),
    "marcos": persona_felizcred(
        "felizcred_marcos.png", "MARCOS, 36 ANOS",
        "Técnico industrial CLT, quer entender as mudanças do FGTS em 2026.",
        ("AS REGRAS DO FGTS MUDARAM EM 2026",
         "Margem maior e FGTS liberado entram na conta na hora de decidir pedir crédito."),
        "Margem de até 35% do salário líquido; FGTS liberado conforme regras vigentes.",
    ),
}


def gerar_persona(nome, persona, out_root):
    bg = os.path.join(BACKGROUNDS, persona["bg"])
    if not os.path.exists(bg):
        print(f"AVISO: fundo nao encontrado, pulando {nome}: {bg}")
        return
    out_dir = os.path.join(out_root, nome)
    os.makedirs(out_dir, exist_ok=True)
    for i, card in enumerate(persona["cards"], start=1):
        render_overlay(
            bg,
            headline=card["headline"],
            subtext=card["subtext"],
            footnote=card["footnote"],
            cta=card.get("cta"),
            out_path=os.path.join(out_dir, f"card{i}.png"),
        )


if __name__ == "__main__":
    for nome, persona in COTACERTA.items():
        gerar_persona(nome, persona, os.path.join(OUT_ROOT, "cotacerta"))
    for nome, persona in FELIZCRED.items():
        gerar_persona(nome, persona, os.path.join(OUT_ROOT, "felizcred"))
    print("\n=== TODOS OS OVERLAYS PRONTOS ===")
