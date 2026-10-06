# -*- coding: utf-8 -*-
"""Gera o site estático da Especitá (v2, editorial) a partir de content.py.
Uso:  python build_site.py"""
import io, os, json, html, datetime
from content import SITE, NAV, SERVICOS, HOME, SOBRE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOM = SITE["dominio"].rstrip("/")
TODAY = datetime.date.today().isoformat()
BY_SLUG = {s["slug"]: s for s in SERVICOS}

# Fotos provisórias (Unsplash, licença livre; trocar pelas fotos reais da clínica — ver README).
def UN(id_): return f"https://images.unsplash.com/{id_}?auto=format&fit=crop&w=1600&q=75"
def PX(id_): return f"https://images.pexels.com/photos/{id_}/pexels-photo-{id_}.jpeg?auto=compress&cs=tinysrgb&w=1600"
PHOTOS = {
    "hero": PX("8413334"), "checkup": PX("6627325"), "child": PX("7800568"), "scanner": PX("5355705"), "portrait": PX("14235198"),
    "office": UN("photo-1629909613654-28e377c37b09"), "smile": UN("photo-1677026010083-78ec7f1b84ed"),
    "implant": UN("photo-1593022356769-11f762e25ed9"), "mirror": UN("photo-1698749778813-ad5f2814e50f"),
    "chair": UN("photo-1598256989800-fe5f95da9787"), "procedure": UN("photo-1588776814546-daab30f310ce"),
}
PHOTO_BY_SLUG = {"dente-quebrado": "mirror", "dor-de-dente": "chair", "implante-dentario": "implant", "ortodontia": "checkup",
                 "alinhador-invisivel": "scanner", "odontopediatria": "child", "tratamento-odontologico": "office",
                 "harmonizacao-facial": "portrait", "clareamento-dental": "procedure", "lente-de-contato-dental": "smile",
                 "dentista-em-brusque": "office"}

WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.1.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>'

def e(s): return html.escape(s, quote=True)
ARR = '<span class="arr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>'
def btn(href, label, cls="btn", extra=""):
    return f'<a class="{cls}" href="{href}"{extra}>{e(label)}{ARR}</a>'
def wa(text, label, cls="btn solid"):
    return f'<a class="{cls}" data-wa-text="{e(text)}" href="https://wa.me/{SITE["whatsapp"]}">{WA_ICON}{e(label)}{ARR}</a>'
def img(key, alt, extra=""):
    return f'<img src="{PHOTOS[key]}" alt="{e(alt)}" loading="lazy" decoding="async" {extra}>'

# ---------------------------------------------------------------- JSON-LD
def ld_business():
    return {"@context": "https://schema.org", "@type": "Dentist", "@id": DOM + "/#clinica", "name": SITE["nome"], "url": DOM + "/",
            "telephone": "+" + SITE["whatsapp"], "image": DOM + "/assets/img/og.png", "priceRange": "$$",
            "address": {"@type": "PostalAddress", "streetAddress": "Rua Sete de Setembro, 55, Sala 1", "addressLocality": "Brusque", "addressRegion": "SC", "postalCode": "88352-000", "addressCountry": "BR"},
            "geo": {"@type": "GeoCoordinates", "latitude": SITE["geo"]["lat"], "longitude": SITE["geo"]["lng"]},
            "openingHoursSpecification": SITE["horario_schema"], "sameAs": [SITE["instagram"]],
            "founder": {"@type": "Person", "name": SITE["dra"], "jobTitle": "Cirurgiã-dentista", "identifier": SITE["cro"]},
            "areaServed": ["Brusque", "Guabiruba", "Botuverá", "Gaspar", "Blumenau", "Itajaí"],
            "medicalSpecialty": ["Dentistry", "Orthodontics", "PediatricDentistry", "Prosthodontics"]}
def ld_service(s):
    return {"@context": "https://schema.org", "@type": "MedicalProcedure", "name": s["h1"], "url": f"{DOM}/{s['slug']}", "description": s["description"],
            "provider": {"@id": DOM + "/#clinica"}, "areaServed": "Brusque, SC", "howPerformed": " ".join(t for t, _ in s["como"]), "bodyLocation": "Boca"}
def ld_faq(faq): return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}
def ld_crumbs(items): return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}
def ld(objs): return "".join(f'<script type="application/ld+json">{json.dumps(o, ensure_ascii=False)}</script>' for o in objs)

# ---------------------------------------------------------------- chrome
def head(title, description, path, lds):
    url = f"{DOM}/{path}" if path else DOM + "/"
    return f'''<!doctype html>
<html lang="pt-BR" data-wa="{SITE["whatsapp"]}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="{e(SITE["nome"])}">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(description)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{DOM}/assets/img/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#3E322A">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,600;1,6..72,500&family=Hanken+Grotesk:wght@400;500;600&display=swap">
<link rel="stylesheet" href="https://unpkg.com/lenis@1.3.26/dist/lenis.css">
<script>if(matchMedia("(min-width:901px) and (prefers-reduced-motion:no-preference)").matches)document.documentElement.classList.add("fx")</script>
<link rel="stylesheet" href="/assets/css/site.css">
{ld(lds)}
</head>
<body>'''

def header(current=""):
    links = "".join(f'<a href="/{slug}"{" aria-current=page" if slug == current else ""}>{e(lbl)}</a>' for slug, lbl in NAV)
    menu = "".join(f'<a href="/{s["slug"]}"><small>{i+1:02d}</small>{e(s["menu"])}</a>' for i, s in enumerate(SERVICOS))
    return f'''<header class="nav">
<a class="brand" href="/">Especitá <small>Brusque</small></a>
<nav class="links" aria-label="Principal">{links}<a href="/sobre">A Dra.</a><a href="/contato">Contato</a></nav>
<a class="cta" data-wa-text="{e(HOME["cta"])}" href="https://wa.me/{SITE["whatsapp"]}">{WA_ICON}WhatsApp</a>
<button class="burger" aria-expanded="false" aria-controls="menu">Menu</button>
</header>
<div class="menu" id="menu">{menu}<a href="/sobre"><small>&nbsp;&nbsp;</small>A Dra.</a><a href="/contato"><small>&nbsp;&nbsp;</small>Contato</a><div class="foot">{e(SITE["endereco_curto"])} · {e(SITE["whatsapp_fmt"])}</div></div>'''

def footer():
    servicos = "".join(f'<li><a href="/{s["slug"]}">{e(s["menu"])}</a></li>' for s in SERVICOS)
    return f'''<footer><p class="big" aria-hidden="true">Especitá</p>
<div class="cols">
<div><h4>Clínica</h4><p>{e(SITE["endereco"])}<br>{e(SITE["referencia"].capitalize())}</p><p>{e(SITE["horario"])}</p></div>
<div><h4>Serviços</h4><ul>{servicos}</ul></div>
<div><h4>Navegar</h4><ul><li><a href="/sobre">Dra. Catiucia</a></li><li><a href="/contato">Contato e como chegar</a></li><li><a href="/dentista-em-brusque">Avaliação completa</a></li><li><a href="{SITE["instagram"]}" rel="noopener" target="_blank">Instagram {e(SITE["instagram_handle"])}</a></li></ul></div>
<div><h4>Atendimento</h4><ul><li><a data-wa-text="{e(HOME["cta"])}" href="https://wa.me/{SITE["whatsapp"]}">WhatsApp {e(SITE["whatsapp_fmt"])}</a></li><li><a href="{SITE["maps"]}" rel="noopener" target="_blank">Google Maps</a></li><li><a href="/privacidade">Privacidade</a></li><li><a href="/termos">Termos</a></li></ul></div>
</div>
<div class="legal">Responsável técnica: {e(SITE["dra"])} · {e(SITE["cro"])} · {e(SITE["epao"])}. Conteúdo informativo; não substitui a consulta. Resultados variam de pessoa para pessoa. Fotos ilustrativas. © {datetime.date.today().year} {e(SITE["nome"])}.</div>
</footer>
<a class="wa-float" data-wa-text="{e(HOME["cta"])}" href="https://wa.me/{SITE["whatsapp"]}" aria-label="Falar no WhatsApp">{WA_ICON}<span>WhatsApp</span></a>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/gsap.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/ScrollTrigger.min.js" defer></script>
<script src="https://unpkg.com/lenis@1.3.26/dist/lenis.min.js" defer></script>
<script src="/assets/js/site.js" defer></script>
</body></html>'''

def ctab(text, label):
    return f'''<section class="ctab" data-nav="dark"><div><h2 data-reveal>Fale com a recepção, <em>sem formulário.</em></h2><p data-reveal>Conte o que você precisa pelo WhatsApp. No horário de atendimento a resposta vem em minutos, já com dois horários para escolher.</p></div><div class="acts" data-reveal>{wa(text, label)}{btn(SITE["maps"], "Como chegar", extra=' target="_blank" rel="noopener"')}</div></section>'''

def local_block():
    return f'''<section class="local" id="local"><div><p class="caps">Onde estamos</p><h2 data-reveal>Santa Rita, <em>em frente à ponte dos bombeiros.</em></h2>
<div class="lines"><div><span>Endereço</span>{e(SITE["endereco"])}</div><div><span>Horário</span>{e(SITE["horario"])}</div><div><span>WhatsApp</span>{e(SITE["whatsapp_fmt"])}</div><div><span>Instagram</span><a href="{SITE["instagram"]}" target="_blank" rel="noopener">{e(SITE["instagram_handle"])}</a></div></div>
<p style="margin-top:28px">{btn(SITE["maps"], "Abrir no Google Maps", extra=' target="_blank" rel="noopener"')}</p></div>
<div class="map" data-reveal><div><div class="pin"></div>Mapa do Google entra aqui quando o site for publicado</div></div></section>'''

# ---------------------------------------------------------------- widgets
def face_svg():
    return '''<svg class="face" viewBox="0 0 320 380" aria-label="Ilustração em linha de um rosto com linhas de expressão" fill="none" stroke="#F4EFE8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
<path d="M70 150 C70 70 120 40 160 40 C200 40 250 70 250 150 C250 230 215 300 160 316 C105 300 70 230 70 150Z"/>
<path d="M90 120 C110 70 210 70 230 120" opacity=".5"/>
<path d="M110 158 q22-14 44 0M166 158 q22-14 44 0" stroke-width="2"/>
<path d="M118 180 q14-10 28 0M174 180 q14-10 28 0"/>
<path d="M160 170 q-10 30 0 62 q8 4 14 0" opacity=".7"/>
<path d="M126 268 q34 14 68 0 M134 272 q26 18 52 0" stroke-width="1.8"/>
<path d="M90 320 C110 350 210 350 230 320" opacity=".4"/>
<g class="rugas" stroke="#B8C3BF" stroke-width="2">
<path class="ruga" d="M112 98 q48-14 96 0"/><path class="ruga" d="M118 112 q42-10 84 0"/>
<path class="ruga" d="M150 136 l-5 18M170 136 l5 18"/>
<path class="ruga" d="M100 166 l-14-5M100 174 l-16 1M100 182 l-14 7"/>
<path class="ruga" d="M220 166 l14-5M220 174 l16 1M220 182 l14 7"/>
<path class="ruga" d="M124 232 q10 18 22 30M196 232 q-10 18-22 30"/>
</g></svg>'''

def widget(s):
    w = s.get("widget"); cta = s["cta"]
    if not w: return ""
    if w == "simulador-expressao":
        body = f'''<p class="caps">Ferramenta</p><div class="two" data-sim="expressao"><div>{face_svg()}</div><div><h3>O que "suavizar" quer dizer</h3><p class="sub">Ilustração interativa. Não é simulação do seu rosto nem previsão de resultado.</p><label for="sim-r" class="caps" style="color:#B8C3BF">Antes → suavizado</label><input id="sim-r" class="range" type="range" min="0" max="100" value="0"><p class="out sim-out"></p><p style="margin-top:22px">{wa(cta, "Agendar avaliação facial")}</p><p class="disc">Testa, entre as sobrancelhas e ao lado dos olhos são as regiões mais comuns da toxina botulínica. Cada rosto pede avaliação individual com a Dra. Catiucia.</p></div></div>'''
    elif w == "implante":
        def crowns(skip):
            out = []
            for i in range(9):
                if skip and i == 4: continue
                x = 76 + i * 31; cx = x + 12
                rot = f' transform="rotate(-6 {cx} 150)"' if (skip and i == 3) else (f' transform="rotate(6 {cx} 150)"' if (skip and i == 5) else "")
                out.append(f'<path d="M{x} 150 v-40 q0-16 12-16 q12 0 12 16 v40z" fill="#F4EFE8" stroke="#C9C2B6" stroke-width="1"{rot}/>')
                out.append(f'<path d="M{x+3} 150 q9 50 9 70 q0-20 9-70z" fill="#D9D1C6" opacity=".9"{rot}/>')
            return "".join(out)
        gum = '<path d="M0 150 h400 v150 h-400z" fill="#5B4A47"/><path d="M0 150 h400" stroke="#F4EFE8" stroke-width="1" opacity=".6"/><path d="M0 206 h400" stroke="#F4EFE8" stroke-width="1" stroke-dasharray="2 6" opacity=".35"/><text x="14" y="200" font-family="Hanken Grotesk, Arial" font-size="9" fill="#F4EFE8" opacity=".55" letter-spacing="1.5">GENGIVA</text><text x="14" y="226" font-family="Hanken Grotesk, Arial" font-size="9" fill="#F4EFE8" opacity=".55" letter-spacing="1.5">OSSO</text>'
        threads = "".join(f'<path d="M-8 {y} h16" stroke="#5B4A47" stroke-width="1.6"/>' for y in range(166, 226, 7))
        gap_x = 76 + 4 * 31 + 12
        before = f'''<svg viewBox="0 0 400 300" class="layer" aria-hidden="true"><rect width="400" height="300" fill="#2F261F"/>{crowns(True)}{gum}<path d="M{gap_x} 96 v54" stroke="#F4EFE8" stroke-width="1" stroke-dasharray="3 5" opacity=".6"/><path d="M{gap_x-14} 150 q14 18 28 0" stroke="#F4EFE8" stroke-width="1" fill="none" opacity=".6"/></svg>'''
        after = f'''<svg viewBox="0 0 400 300" class="layer after" aria-hidden="true"><rect width="400" height="300" fill="#2F261F"/>{crowns(False)}{gum}<g transform="translate({gap_x} 0)"><rect x="-4" y="150" width="8" height="12" fill="#B8C3BF"/><path d="M-8 162 h16 v56 l-8 10 l-8-10z" fill="#9FB7B0"/>{threads}<path d="M-8 162 h16 v56 l-8 10 l-8-10z" fill="none" stroke="#F4EFE8" stroke-width="1"/></g></svg>'''
        rules = json.dumps({"1": "Um dente faltando: o caso clássico de implante unitário com coroa. A avaliação confirma osso e gengiva.",
                            "varios": "Vários dentes: pode ser implantes individuais ou prótese fixa sobre implantes. O planejamento digital compara as opções.",
                            "todos": "Todos os dentes de uma arcada: a prótese protocolo (fixa sobre implantes) é a alternativa à prótese móvel que solta.",
                            "default": "A avaliação com planejamento digital é o próximo passo."}, ensure_ascii=False)
        body = f'''<p class="caps">Ferramenta</p><div class="two"><div><h3>Antes e depois, <em>em ilustração</em></h3><p class="sub">Arraste a barra. Didático, não é um caso real.</p><div class="ba">{before}{after}<div class="handle"><i>⇆</i></div><span class="lbl l">Sem o dente</span><span class="lbl r">Com implante</span><input type="range" min="0" max="100" value="50" aria-label="Comparar antes e depois"></div><p class="disc">À esquerda, o espaço sem o dente e os vizinhos que tendem a inclinar. À direita, o implante com a coroa.</p></div>
<div class="quiz" data-cta="{e(cta)}" data-rules='{e(rules)}'><h3>Qual é o <em>meu</em> caso?</h3><p class="sub">Três perguntas para a recepção já te orientar.</p><div class="prog"><i></i></div>
<div class="q on"><b>Quantos dentes faltam?</b><div class="opts"><button data-v="1">Só 1</button><button data-v="varios">Vários</button><button data-v="todos">Todos (uso prótese)</button></div></div>
<div class="q"><b>Usa prótese móvel hoje?</b><div class="opts"><button data-v="protese sim">Sim</button><button data-v="protese nao">Não</button></div></div>
<div class="q"><b>Há quanto tempo está assim?</b><div class="opts"><button data-v="menos de 1 ano">Menos de 1 ano</button><button data-v="1 a 5 anos">1 a 5 anos</button><button data-v="mais de 5 anos">Mais de 5 anos</button></div></div>
<div class="res"><p class="txt"></p><a class="btn solid" href="#">{WA_ICON}Enviar respostas e agendar{ARR}</a></div></div></div>'''
    elif w == "triagem-dor":
        rules = json.dumps({"inchaco sim": "Inchaço ou febre indicam infecção: procure atendimento hoje. Avise a recepção que há inchaço; esses casos têm prioridade.",
                            "inchaco nao|hoje": "Dor recente sem inchaço: vale avaliar nos próximos dias para evitar que evolua. Peça um encaixe.",
                            "inchaco nao|dias": "Dor há alguns dias sem melhora: a causa precisa ser tratada. Peça um encaixe.",
                            "inchaco nao|semana": "Dor persistente há mais de uma semana costuma indicar inflamação do nervo. Não adie a avaliação.",
                            "default": "Peça um encaixe pelo WhatsApp e conte o que sente."}, ensure_ascii=False)
        body = f'''<p class="caps">Ferramenta</p><div class="two"><div><h3>Triagem rápida <em>da dor</em></h3><p class="sub">As duas perguntas que a recepção faria. Não substitui a avaliação.</p></div><div class="quiz" data-cta="{e(cta)}" data-rules='{e(rules)}'><div class="prog"><i></i></div>
<div class="q on"><b>Tem inchaço no rosto ou na gengiva, ou febre?</b><div class="opts"><button data-v="inchaco sim">Sim</button><button data-v="inchaco nao">Não</button></div></div>
<div class="q"><b>Há quanto tempo dói?</b><div class="opts"><button data-v="hoje">Começou hoje</button><button data-v="dias">Alguns dias</button><button data-v="semana">Mais de uma semana</button></div></div>
<div class="res"><p class="txt"></p><a class="btn solid" href="#">{WA_ICON}Pedir encaixe agora{ARR}</a></div></div></div>'''
    elif w == "checklist-urgencia":
        itens = ["Dente da frente", "Está doendo", "Tenho o pedaço do dente", "Está sangrando", "Foi uma pancada ou queda", "Caiu uma restauração"]
        body = f'''<p class="caps">Ferramenta</p><div class="two"><div><h3>Me conte <em>o que aconteceu</em></h3><p class="sub">Marque o que se aplica. A mensagem para a recepção já vai preenchida.</p></div><div class="chk-wa"><div class="chk">{"".join(f'<label><input type="checkbox"> {e(i)}</label>' for i in itens)}</div><p style="margin-top:18px"><a class="btn solid" data-chk-cta="{e(cta)}" href="#" target="_blank" rel="noopener">{WA_ICON}Enviar e pedir encaixe{ARR}</a></p></div></div>'''
    elif w == "primeiro-dentinho":
        body = f'''<p class="caps">Ferramenta</p><div class="two"><div><h3>Quando levar <em>meu bebê</em> ao dentista?</h3><p class="sub">Digite a idade em meses e veja a orientação para essa fase.</p></div><div class="calc" data-calc="dentinho"><label class="caps" for="meses" style="color:#B8C3BF">Idade do bebê (meses)</label><div class="num"><button type="button" data-step="-1" aria-label="Menos um mês">&minus;</button><input id="meses" type="number" min="0" max="144" value="8"><button type="button" data-step="1" aria-label="Mais um mês">+</button></div><div class="out" style="margin-top:14px"></div><p style="margin-top:18px">{wa(cta, "Agendar a primeira visita")}</p><p class="disc">Base: recomendações das sociedades de odontopediatria (primeira visita até 1 ano). Orientação geral; a Dra. avalia cada criança.</p></div></div>'''
    elif w == "comparar-orto":
        body = f'''<p class="caps">Ferramenta</p><div class="two"><div><h3>Fixo ou <em>alinhador?</em></h3><p class="sub">Clique em uma opção para destacar. A indicação final é da Dra. Catiucia, na avaliação.</p><p style="margin-top:22px">{wa(cta, "Avaliar qual é o melhor para mim")}</p></div>
<div class="cmp"><div class="opts"><div class="opt on" data-k="fixo"><b>Aparelho fixo</b><span>Braquetes colados, ajustes nas manutenções.</span></div><div class="opt" data-k="alin"><b>Alinhador</b><span>Placas transparentes removíveis.</span></div></div>
<table><tbody>
<tr><td>Aparência</td><td data-k="fixo">Visível (metálico ou estético)</td><td data-k="alin">Quase imperceptível</td></tr>
<tr><td>Para comer</td><td data-k="fixo">Com restrições</td><td data-k="alin">Sem restrição: a placa sai</td></tr>
<tr><td>Higiene</td><td data-k="fixo">Exige mais cuidado</td><td data-k="alin">Escova normalmente</td></tr>
<tr><td>Disciplina</td><td data-k="fixo">Não depende do uso</td><td data-k="alin">Usar ~22 h por dia</td></tr>
<tr><td>Casos</td><td data-k="fixo">Todos, inclusive complexos</td><td data-k="alin">Leves a moderados</td></tr>
<tr><td>Manutenção</td><td data-k="fixo">A cada 4 a 6 semanas</td><td data-k="alin">A cada 6 a 10 semanas</td></tr>
</tbody></table></div></div>'''
    elif w == "escala-clareamento":
        body = f'''<p class="caps">Ferramenta</p><div class="two"><div><h3>Escala de tons, <em>em ilustração</em></h3><p class="sub">Arraste para ver a lógica do clareamento. Não é previsão do seu resultado.</p><p style="margin-top:22px">{wa(cta, "Agendar avaliação para clareamento")}</p></div><div><div class="shade"></div><input class="range shade-range" type="range" min="0" max="7" value="1" aria-label="Tom"><p class="out shade-lbl"></p><p class="disc">Restaurações e facetas não clareiam. O tom final depende do esmalte de cada pessoa e do protocolo supervisionado.</p></div></div>'''
    else:
        return ""
    return f'<section class="tool" id="ferramenta" data-nav="dark"><div class="inner">{body}</div></section>'

# ---------------------------------------------------------------- páginas
def service_page(s):
    crumbs = [("Início", DOM + "/"), (s["menu"], f"{DOM}/{s['slug']}")]
    lds = [ld_business(), ld_service(s), ld_faq(s["faq"]), ld_crumbs(crumbs)]
    h1 = s["h1"]
    if ":" in h1:
        a, b = h1.split(":", 1); h1html = f'{e(a.strip())}: <em>{e(b.strip())}</em>'
    else: h1html = e(h1)
    para = "".join(f'<div class="row" data-reveal><span class="n">{i+1:02d}</span><h3>{e(t)}</h3><p>{e(d)}</p></div>' for i, (t, d) in enumerate(s["para_quem"]))
    como = "".join(f'<li class="{"on" if i == 0 else ""}" data-reveal><span class="dot">{i+1}</span><h3>{e(t)}</h3><p>{e(d)}</p></li>' for i, (t, d) in enumerate(s["como"]))
    sinais = "".join(f'<li>{e(i)}</li>' for i in s["sinais"])
    faq = "".join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in s["faq"])
    rel = "".join(f'<a href="/{r}" data-reveal><span class="caps mute">{e(BY_SLUG[r]["grupo"])}</span><span class="t">{e(BY_SLUG[r]["menu"])}</span><span class="d">{e(BY_SLUG[r]["lede"].split(". ")[0])}.</span></a>' for r in s["relacionados"])
    aviso = f'<p class="aviso" style="margin-top:22px">{e(s["aviso"])}</p>' if s.get("aviso") else ""
    ph = PHOTO_BY_SLUG.get(s["slug"], "office")
    return head(s["title"], s["description"], s["slug"], lds) + header(s["slug"]) + f'''
<main>
<section class="shero"><div class="tx"><div class="crumbs"><a href="/">Início</a><span>›</span><span>{e(s["grupo"])}</span><span>›</span><span>Brusque</span></div>
<h1>{h1html}</h1><p class="lede">{e(s["lede"])}</p><div class="acts">{wa(s["cta"], s["cta_label"])}{btn("#faq", "Dúvidas comuns")}</div>{aviso}</div>
<div class="ph">{img(ph, s["menu"] + " na Especitá, Brusque", 'fetchpriority="high"')}<span class="tag">{e(SITE["dra"])}<br>{e(SITE["cro"])}</span></div></section>

<section class="sec"><div class="inner"><div class="head"><p class="caps">Para quem é</p><h2 data-reveal>Quando <em>procurar.</em></h2></div><div class="rows">{para}</div></div></section>

{widget(s)}

<section class="sec steps"><div class="inner"><div class="head"><p class="caps">Como funciona na Especitá</p><h2 data-reveal>Passo <em>a passo.</em></h2></div><div class="tl"><ol>{como}</ol><div class="side" data-clip>{img("procedure" if ph != "procedure" else "office", "Atendimento na Especitá")}<span class="tag">Especitá · Brusque</span></div></div></div></section>

<section class="sec"><div class="inner ficha"><div><p class="caps" style="margin-bottom:14px">{e(s["sinais_titulo"])}</p><ul>{sinais}</ul></div>
<div class="card" data-reveal><p class="caps">Responsável técnica</p><b>{e(SITE["dra"])}</b><p>{e(SITE["cro"])} · {e(SITE["epao"])}. Mais de 10 anos atendendo em Brusque; acompanha cada paciente do primeiro contato à manutenção.</p><p><a href="/sobre" class="link">Conheça a Dra.</a></p></div></div></section>

<section class="sec" id="faq"><div class="inner faq-grid"><div class="st"><p class="caps">Perguntas frequentes</p><h2 data-reveal style="font-size:clamp(34px,4vw,56px)">{e(s["menu"])}: <em>dúvidas comuns.</em></h2><p class="mute" style="margin-top:18px;max-width:34ch">Não achou a sua? Pergunte pelo WhatsApp, a recepção responde no horário de atendimento.</p></div><div class="faq">{faq}</div></div></section>

{ctab(s["cta"], s["cta_label"])}

<section class="sec"><div class="inner"><div class="head"><p class="caps">Veja também</p><h2 data-reveal>Outros <em>cuidados.</em></h2></div><div class="related">{rel}</div></div></section>
{local_block()}
</main>''' + footer()

def home_page():
    lds = [ld_business(), {"@context": "https://schema.org", "@type": "WebSite", "name": SITE["nome"], "url": DOM + "/"}]
    def lst(items): return "".join(f'<li><a href="/{sl}">{e(t)}</a></li>' for sl, t in items)
    PANELS = [
        ("mirror", "Urgência", "no mesmo dia", "Dente quebrado ou dor de dente não espera. Encaixes diários, de segunda a sábado.", [("dente-quebrado", "Dente quebrado"), ("dor-de-dente", "Dor de dente")]),
        ("implant", "Implante", "e prótese", "Voltar a mastigar com segurança, a partir de um planejamento digital do seu caso.", [("implante-dentario", "Implante dentário"), ("implante-dentario", "Prótese protocolo")]),
        ("scanner", "Ortodontia", "fixo ou invisível", "Dentes alinhados para crianças, adolescentes e adultos, com acompanhamento aqui em Brusque.", [("ortodontia", "Aparelho ortodôntico"), ("alinhador-invisivel", "Alinhador invisível")]),
        ("child", "Infantil", "e família", "A primeira visita é só para conhecer. A família inteira atendida no mesmo dia, em horários seguidos.", [("odontopediatria", "Dentista para crianças"), ("tratamento-odontologico", "Tratamento geral e família"), ("dentista-em-brusque", "Avaliação e check-up")]),
        ("portrait", "Estética", "do sorriso e do rosto", "Clareamento, lentes e harmonização orofacial, sempre a partir de uma avaliação individual.", [("clareamento-dental", "Clareamento dental"), ("lente-de-contato-dental", "Lente de contato dental"), ("harmonizacao-facial", "Harmonização facial")]),
    ]
    panels = "".join(f'<article class="svc-panel"><div class="sp-photo">{img(k, a_ + " " + b_)}<h2 class="sp-title">{e(a_)}<em>{e(b_)}</em></h2></div><div class="sp-side"><p class="caps">Nossos cuidados</p><p class="sp-desc">{e(d)}</p><ul class="sp-list">{lst(l)}</ul></div></article>' for k, a_, b_, d, l in PANELS)
    index = "".join(f"<li>{e(a_)}</li>" for _, a_, _, _, _ in PANELS)
    steps = [("Chame no WhatsApp", "Conte o que precisa. No horário de atendimento, a resposta vem em minutos, já com dois horários para escolher.", "chair"),
             ("Avaliação completa", "Exame, fotos e radiografias quando necessário. A Dra. explica o que vê e monta o plano com você, em linguagem simples.", "procedure"),
             ("Tratamento e revisão", "Em etapas, no seu ritmo. Depois, lembrete de revisão a cada seis meses pelo WhatsApp.", "scanner")]
    srows = "".join(f'<li class="stp-row{" on" if i == 0 else ""}"><h3>{e(t)}</h3><p>{e(d)}</p></li>' for i, (t, d, _) in enumerate(steps))
    spics = "".join(img(k, t, 'class="on"' if i == 0 else "") for i, (t, _, k) in enumerate(steps))
    return head(HOME["title"], HOME["description"], "", lds) + header("") + f'''
<main>
<section class="hero">
<div class="hero-pin">
  <div class="h-copy">
    <p class="h-meta">Santa Rita · Brusque · SC</p>
    <h1 class="h-title">Odontologia<br>e estética,<em>com calma.</em></h1>
    <p class="h-sub">Implantes, aparelhos, dentista para crianças, clareamento e harmonização, com a mesma profissional do início ao fim.</p>
  </div>
  <div class="h-media">
    {img("hero", "Dra. atendendo paciente na Especitá", 'class="hp" fetchpriority="high" loading="eager"')}
    {img("office", "Consultório da Especitá", 'class="hp" loading="eager"')}
    {img("smile", "Sorriso", 'class="hp" loading="eager"')}
    <div class="h-copy" aria-hidden="true"><p class="h-title">Odontologia<br>e estética,<em>com calma.</em></p><p class="h-cap">Um plano explicado em linguagem simples, no seu ritmo.</p></div>
    <p class="h-sweep" aria-hidden="true">Seu sorriso, <em>no seu tempo.</em></p>
  </div>
</div>
</section>

<section class="mf" data-reveal-skip>
  <div class="card">{img("checkup", "Dra. Catiucia (foto provisória)")}<span>Dra. Catiucia · CRO-SC 14067</span></div>
  <div><p class="big">A Especitá é uma clínica de bairro, no Santa Rita, onde a mesma dentista conhece o seu histórico, explica cada passo e organiza o tratamento com você, sem pressa e sem jargão.</p>
  <div class="meta"><div><b data-count="10" data-suffix="+">0</b>anos em Brusque</div><div><b data-count="11">0</b>cuidados no mesmo lugar</div><div><b data-count="6">0</b>dias por semana com encaixe</div></div></div>
</section>

<section class="svc" data-nav="dark" id="servicos">
  <ol class="svc-index">{index}</ol>
  {panels}
</section>

<section class="stp" id="como">
  <div class="head"><p class="caps">Como funciona</p><h2>Três passos, <em>sem formulário.</em></h2></div>
  <div class="stp-grid"><div><p class="stp-count"><b>01</b> <small>/ 03</small></p><div class="stp-pic">{spics}</div></div><ol class="stp-rows">{srows}</ol></div>
</section>

<section class="dra"><div class="ph">{img("checkup", "Dra. Catiucia em atendimento")}</div><div class="tx"><p class="caps">A Dra.</p><h2 data-reveal>Catiucia <em>L. Riffel</em></h2><p style="margin-top:22px">Cirurgiã-dentista, há mais de dez anos em Brusque. Fundou a Especitá para que o paciente tenha uma só profissional do primeiro contato à manutenção, em qualquer especialidade.</p><dl><div><dt>Registro</dt><dd>{e(SITE["cro"])}</dd></div><div><dt>Habilitação</dt><dd>EPAO 4417</dd></div><div><dt>Em Brusque</dt><dd>10+ anos</dd></div></dl><p style="margin-top:28px"><a class="link" href="/sobre">Conheça a Dra.</a></p></div></section>

{ctab(HOME["cta"], "Agendar pelo WhatsApp")}
{local_block()}
</main>''' + footer()

def sobre_page():
    lds = [ld_business(), {"@context": "https://schema.org", "@type": "Person", "name": SITE["dra"], "jobTitle": "Cirurgiã-dentista", "identifier": SITE["cro"], "worksFor": {"@id": DOM + "/#clinica"}, "url": DOM + "/sobre"}]
    texto = "".join(f"<p>{e(t)}</p>" for t in SOBRE["texto"])
    return head(SOBRE["title"], SOBRE["description"], "sobre", lds) + header("") + f'''
<main><section class="shero"><div class="tx"><div class="crumbs"><a href="/">Início</a><span>›</span><span>A Dra.</span></div><h1>Catiucia <em>L. Riffel</em></h1><p class="lede">{e(SITE["cro"])} · {e(SITE["epao"])}</p><div class="acts">{wa(HOME["cta"], "Agendar avaliação")}</div></div><div class="ph">{img("checkup", "Dra. Catiucia", 'fetchpriority="high"')}<span class="tag">Foto a substituir<br>pela foto real da Dra.</span></div></section>
<section class="sec"><div class="ficha"><div style="font-size:19px;color:var(--ink-2)">{texto}<p class="aviso">{e(SOBRE["formacao_placeholder"])}</p></div><div class="card" data-reveal><p class="caps">Na Especitá</p><b>Uma profissional, do início ao fim</b><p>Odontologia geral, implantes, ortodontia, odontopediatria, estética do sorriso e harmonização orofacial, no mesmo consultório, com o mesmo histórico.</p></div></div></section>
{local_block()}</main>''' + footer()

def contato_page():
    lds = [ld_business(), ld_crumbs([("Início", DOM + "/"), ("Contato", DOM + "/contato")])]
    return head("Contato e como chegar | Especitá Odontologia · Brusque", "WhatsApp, endereço, horário e como chegar à Especitá Odontologia e Estética, no Santa Rita, em Brusque, em frente à ponte dos bombeiros.", "contato", lds) + header("") + f'''
<main><section class="shero"><div class="tx"><div class="crumbs"><a href="/">Início</a><span>›</span><span>Contato</span></div><h1>Fale com <em>a recepção.</em></h1><p class="lede">O jeito mais rápido é o WhatsApp. Conte o que você precisa e receba os horários disponíveis.</p><div class="acts">{wa(HOME["cta"], "Chamar no WhatsApp")}{btn(SITE["instagram"], "Instagram", extra=' target="_blank" rel="noopener"')}</div></div><div class="ph">{img("office", "Consultório da Especitá", 'fetchpriority="high"')}<span class="tag">Rua Sete de Setembro, 55<br>Santa Rita · Brusque</span></div></section>
{local_block()}
<section class="sec"><div class="ficha"><div><p class="caps" style="margin-bottom:14px">O que trazer na primeira consulta</p><ul><li>Documento com foto.</li><li>Exames, radiografias ou orçamentos anteriores, se tiver.</li><li>Lista de medicamentos em uso.</li><li>Carteirinha do convênio, se for o caso (confirme o atendimento pelo WhatsApp).</li></ul></div></div></section></main>''' + footer()

LEGAL_PRIV = f'''<h3>Quem somos</h3><p>{SITE["nome"]}, responsável técnica {SITE["dra"]} ({SITE["cro"]}), com sede na {SITE["endereco"]}. [CNPJ: preencher]</p>
<h3>Quais dados coletamos</h3><p>Ao entrar em contato pelo WhatsApp, coletamos nome, telefone, a mensagem enviada e, quando você informa, dados sobre o atendimento desejado. Ao navegar, podem ser coletados dados de uso por ferramentas de medição (Google Analytics, Meta Pixel), conforme sua configuração de cookies.</p>
<h3>Para que usamos</h3><p>Para responder ao seu contato, agendar e confirmar consultas, enviar lembretes e, com o seu consentimento, comunicações sobre a clínica. Dados de saúde são tratados apenas no contexto do atendimento odontológico, com sigilo profissional.</p>
<h3>Com quem compartilhamos</h3><p>Com provedores necessários à operação (Meta/WhatsApp Business, hospedagem, ferramentas de agenda e medição), sempre limitados à finalidade. Não vendemos dados.</p>
<h3>Seus direitos (LGPD)</h3><p>Você pode solicitar acesso, correção, exclusão ou portabilidade dos seus dados e revogar consentimentos pelo WhatsApp {SITE["whatsapp_fmt"]} ou pelo e-mail [preencher]. Para sair das comunicações, responda SAIR a qualquer mensagem.</p>
<h3>Retenção e segurança</h3><p>Dados de atendimento são mantidos pelo prazo exigido pelas normas odontológicas e fiscais. Adotamos medidas técnicas e organizacionais para proteger as informações.</p><p class="mute">Última atualização: {TODAY}.</p>'''
LEGAL_TERMS = f'''<h3>Uso do site</h3><p>O conteúdo deste site é informativo e educativo. Não substitui consulta, diagnóstico ou tratamento com profissional habilitado. Resultados de tratamentos variam de pessoa para pessoa.</p>
<h3>Agendamentos</h3><p>Horários solicitados pelo WhatsApp são confirmados pela recepção. Cancelamentos e remarcações devem ser avisados com antecedência pelo mesmo canal.</p>
<h3>Propriedade intelectual</h3><p>Textos, ilustrações e marca pertencem à {SITE["nome"]}. Ilustrações interativas são didáticas e não representam casos reais ou previsões de resultado. Fotografias de banco de imagens são ilustrativas.</p>
<h3>Responsabilidade profissional</h3><p>Responsável técnica: {SITE["dra"]}, {SITE["cro"]}. Publicidade conforme o Código de Ética Odontológica.</p><p class="mute">Última atualização: {TODAY}.</p>'''

def legal_page(slug, title, body):
    return head(f"{title} | Especitá", f"{title} da Especitá Odontologia e Estética, Brusque.", slug, [ld_business()]) + header("") + f'''<main><section class="sec" style="padding-top:140px;max-width:860px"><h1 style="font-size:clamp(40px,6vw,88px)">{e(title)}</h1><div style="margin-top:36px;font-size:17px;color:var(--ink-2)">{body}</div></section></main>''' + footer()

# ---------------------------------------------------------------- arquivos auxiliares
def write(path, content):
    full = os.path.join(ROOT, path); os.makedirs(os.path.dirname(full), exist_ok=True)
    io.open(full, "w", encoding="utf-8").write(content)

def build():
    pages = {"index.html": home_page(), "sobre.html": sobre_page(), "contato.html": contato_page(),
             "privacidade.html": legal_page("privacidade", "Política de privacidade", LEGAL_PRIV),
             "termos.html": legal_page("termos", "Termos de uso", LEGAL_TERMS)}
    for s in SERVICOS: pages[s["slug"] + ".html"] = service_page(s)
    for p, c in pages.items(): write(p, c)
    urls = [("", "1.0")] + [(s["slug"], "0.9") for s in SERVICOS] + [("sobre", "0.6"), ("contato", "0.6"), ("privacidade", "0.2"), ("termos", "0.2")]
    write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"  <url><loc>{DOM}/{u}</loc><lastmod>{TODAY}</lastmod><priority>{p}</priority></url>\n" for u, p in urls) + "</urlset>\n")
    write("robots.txt", f"User-agent: *\nAllow: /\nSitemap: {DOM}/sitemap.xml\n")
    write("llms.txt", f"# {SITE['nome']}\n\n> Clínica odontológica e de estética em Brusque/SC. Responsável técnica {SITE['dra']} ({SITE['cro']}). Atendimento pelo WhatsApp {SITE['whatsapp_fmt']}. Endereço: {SITE['endereco']}, {SITE['referencia']}. {SITE['horario']}.\n\n## Serviços\n" + "".join(f"- [{s['menu']}]({DOM}/{s['slug']}): {s['description']}\n" for s in SERVICOS) + f"\n## Clínica\n- [A Dra.]({DOM}/sobre)\n- [Contato]({DOM}/contato)\n\n## Regras de conteúdo\nEste site não divulga preços, promoções ou promessas de resultado (Código de Ética Odontológica). Valores são informados na avaliação ou pelo WhatsApp.\n")
    write("vercel.json", json.dumps({"cleanUrls": True, "trailingSlash": False, "headers": [{"source": "/assets/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}]}, {"source": "/(.*)", "headers": [{"key": "X-Content-Type-Options", "value": "nosniff"}, {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"}]}]}, indent=2))
    write("assets/img/favicon.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#3E322A"/><text x="32" y="46" text-anchor="middle" font-family="Georgia, serif" font-size="40" fill="#F4EFE8">E</text></svg>')
    print("ok:", len(pages), "páginas em", ROOT)

if __name__ == "__main__":
    build()
