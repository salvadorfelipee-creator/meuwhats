# -*- coding: utf-8 -*-
"""Gera o site estático da Especitá a partir de content.py.
Uso:  python build_site.py   (gera os .html na pasta site/, um nível acima)"""
import io, os, json, html, datetime
from content import SITE, NAV, SERVICOS, HOME, SOBRE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # pasta site/
DOM = SITE["dominio"].rstrip("/")
TODAY = datetime.date.today().isoformat()
BY_SLUG = {s["slug"]: s for s in SERVICOS}

WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.1.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>'
ICONS = {
    "tooth": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 8 .3 2 .8 5.5 2.5 5.5S10 17 12 17s2.8 4 4.5 4 2.2-3.5 2.5-5.5c.5-3.5 2-5 2-8C21 5 19.5 3 17 3c-2 0-3 1.2-5 1.2S9 3 7 3z"/></svg>',
    "bolt": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
    "smile": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>',
    "child": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>',
    "spark": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>',
    "pin": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
}
GRUPO_ICON = {"Urgência": "bolt", "Implante e prótese": "tooth", "Ortodontia": "smile", "Infantil": "child", "Família": "tooth", "Estética facial": "spark", "Estética do sorriso": "smile", "Avaliação": "pin"}

def e(s): return html.escape(s, quote=True)

def wa(text, label, cls="btn btn-wa"):
    return f'<a class="{cls}" data-wa-text="{e(text)}" href="https://wa.me/{SITE["whatsapp"]}">{WA_ICON}{e(label)}</a>'

# ---------------------------------------------------------------- JSON-LD
def ld_business():
    return {
        "@context": "https://schema.org", "@type": "Dentist", "@id": DOM + "/#clinica",
        "name": SITE["nome"], "url": DOM + "/", "telephone": "+" + SITE["whatsapp"],
        "image": DOM + "/assets/img/og.png", "priceRange": "$$",
        "address": {"@type": "PostalAddress", "streetAddress": "Rua Sete de Setembro, 55, Sala 1", "addressLocality": "Brusque", "addressRegion": "SC", "postalCode": "88352-000", "addressCountry": "BR"},
        "geo": {"@type": "GeoCoordinates", "latitude": SITE["geo"]["lat"], "longitude": SITE["geo"]["lng"]},
        "openingHoursSpecification": SITE["horario_schema"],
        "sameAs": [SITE["instagram"]],
        "founder": {"@type": "Person", "name": SITE["dra"], "jobTitle": "Cirurgiã-dentista", "identifier": SITE["cro"]},
        "areaServed": ["Brusque", "Guabiruba", "Botuverá", "Gaspar", "Blumenau", "Itajaí"],
        "medicalSpecialty": ["Dentistry", "Orthodontics", "PediatricDentistry", "Prosthodontics"],
    }

def ld_service(s):
    return {"@context": "https://schema.org", "@type": "MedicalProcedure", "name": s["h1"], "url": f"{DOM}/{s['slug']}", "description": s["description"],
            "provider": {"@id": DOM + "/#clinica"}, "areaServed": "Brusque, SC", "howPerformed": " ".join(t for t, _ in s["como"]),
            "bodyLocation": "Boca"}

def ld_faq(faq):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}

def ld_crumbs(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}

def ld(objs):
    return "".join(f'<script type="application/ld+json">{json.dumps(o, ensure_ascii=False)}</script>' for o in objs)

# ---------------------------------------------------------------- chrome
def head(title, description, path, lds, extra=""):
    url = f"{DOM}/{path}" if path else DOM + "/"
    return f'''<!doctype html>
<html lang="pt-BR" data-wa="{SITE["whatsapp"]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{DOM}/assets/img/og.png">
<meta property="og:site_name" content="{e(SITE["nome"])}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E7C6B">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Instrument+Sans:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/css/site.css">
{ld(lds)}{extra}
</head>
<body>'''

def header(current=""):
    links = "".join(f'<a href="/{slug}"{" aria-current=page" if slug == current else ""}>{e(lbl)}</a>' for slug, lbl in NAV)
    return f'''<header class="top"><div class="wrap">
<a class="logo" href="/"><i>E</i><span>Especitá<small>Odontologia e Estética · Brusque</small></span></a>
<button class="burger" aria-expanded="false" aria-controls="nav">Menu</button>
<nav class="main" id="nav" aria-label="Principal">{links}<a href="/sobre">A Dra.</a><a href="/contato">Contato</a></nav>
{wa(HOME["cta"], "WhatsApp")}
</div></header>'''

def footer():
    servicos = "".join(f'<li><a href="/{s["slug"]}">{e(s["menu"])}</a></li>' for s in SERVICOS)
    return f'''<footer><div class="wrap">
<div class="cols">
<div><a class="logo" href="/"><i>E</i><span>Especitá<small>Odontologia e Estética</small></span></a>
<p style="margin-top:12px">{e(SITE["endereco"])}<br>{e(SITE["referencia"].capitalize())}</p>
<p>{e(SITE["horario"])}</p></div>
<div><h4>Serviços</h4><ul>{servicos}</ul></div>
<div><h4>Clínica</h4><ul><li><a href="/sobre">Dra. Catiucia</a></li><li><a href="/contato">Contato e como chegar</a></li><li><a href="/dentista-em-brusque">Avaliação completa</a></li><li><a href="{SITE["instagram"]}" rel="noopener" target="_blank">Instagram {e(SITE["instagram_handle"])}</a></li></ul></div>
<div><h4>Atendimento</h4><ul><li><a data-wa-text="{e(HOME["cta"])}" href="https://wa.me/{SITE["whatsapp"]}">WhatsApp {e(SITE["whatsapp_fmt"])}</a></li><li><a href="{SITE["maps"]}" rel="noopener" target="_blank">Abrir no Google Maps</a></li><li><a href="/privacidade">Política de privacidade</a></li><li><a href="/termos">Termos de uso</a></li></ul></div>
</div>
<div class="legal">Responsável técnica: {e(SITE["dra"])} · {e(SITE["cro"])} · {e(SITE["epao"])}. Este site é informativo e não substitui a consulta. Resultados variam de pessoa para pessoa. © {datetime.date.today().year} {e(SITE["nome"])}.</div>
</div></footer>
<a class="wa-float" data-wa-text="{e(HOME["cta"])}" href="https://wa.me/{SITE["whatsapp"]}" aria-label="Falar no WhatsApp">{WA_ICON}<span>Falar no WhatsApp</span></a>
<script src="/assets/js/site.js" defer></script>
</body></html>'''

def dra_box():
    return f'''<div class="dra"><div class="ph">C</div><div><b>{e(SITE["dra"])}</b><p>{e(SITE["cro"])} · {e(SITE["epao"])}. Mais de 10 anos atendendo em Brusque. Acompanha cada paciente do primeiro contato à manutenção.</p><p><a href="/sobre">Conheça a Dra. →</a></p></div></div>'''

def cta_band(text, label):
    return f'''<section><div class="wrap"><div class="cta-band"><div><h2>Fale com a recepção agora</h2><p>Resposta rápida no horário de atendimento. Conte o que você precisa e receba os horários disponíveis.</p></div><div class="acts">{wa(text, label)}<a class="btn btn-ghost" href="{SITE["maps"]}" target="_blank" rel="noopener">Como chegar</a></div></div></div></section>'''

def local_block():
    return f'''<section class="alt" id="local"><div class="wrap"><div class="local">
<div><span class="eyebrow">Onde estamos</span><h2>No Santa Rita, em frente à ponte dos bombeiros</h2>
<dl style="margin-top:18px"><dt>Endereço</dt><dd>{e(SITE["endereco"])}</dd><dt>Horário</dt><dd>{e(SITE["horario"])}</dd><dt>WhatsApp</dt><dd>{e(SITE["whatsapp_fmt"])}</dd><dt>Instagram</dt><dd><a href="{SITE["instagram"]}" target="_blank" rel="noopener">{e(SITE["instagram_handle"])}</a></dd></dl>
<p style="margin-top:18px"><a class="btn btn-sand" href="{SITE["maps"]}" target="_blank" rel="noopener">{ICONS["pin"].replace('<svg', '<svg style="width:18px;height:18px"')} Abrir no Google Maps</a></p></div>
<div class="map"><div><b>Mapa</b><br><span class="small">Substituir por embed do Google Maps quando o domínio estiver no ar (ver README).</span></div></div>
</div></div></section>'''

# ---------------------------------------------------------------- widgets
def face_svg():
    # rosto ilustrativo com linhas de expressão (classe .ruga)
    return '''<svg viewBox="0 0 320 360" aria-label="Ilustração de um rosto com linhas de expressão" style="width:100%;max-width:320px;display:block;margin:0 auto">
<defs><linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F5E3D6"/><stop offset="1" stop-color="#E9CDBB"/></linearGradient></defs>
<ellipse cx="160" cy="190" rx="110" ry="140" fill="url(#skin)"/>
<path d="M60 150 Q160 20 260 150 Q250 70 160 60 Q70 70 60 150Z" fill="#5A3E36"/>
<ellipse cx="120" cy="175" rx="14" ry="8" fill="#fff"/><circle cx="120" cy="175" r="5" fill="#3B2A24"/>
<ellipse cx="200" cy="175" rx="14" ry="8" fill="#fff"/><circle cx="200" cy="175" r="5" fill="#3B2A24"/>
<path d="M100 158 q20-10 40 0M180 158 q20-10 40 0" stroke="#5A3E36" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M160 190 q-6 18 4 26" stroke="#D9B8A5" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M130 262 q30 18 60 0" stroke="#B9655E" stroke-width="5" fill="none" stroke-linecap="round"/>
<g class="rugas" stroke="#B88C77" fill="none" stroke-linecap="round">
<path class="ruga" d="M105 112 q55-10 110 0"/><path class="ruga" d="M110 126 q50-8 100 0"/>
<path class="ruga" d="M150 150 l-4 22M170 150 l4 22"/>
<path class="ruga" d="M92 180 l-14-6M92 188 l-15 2M92 196 l-13 8"/>
<path class="ruga" d="M228 180 l14-6M228 188 l15 2M228 196 l13 8"/>
<path class="ruga" d="M120 225 q6 20 18 34M200 225 q-6 20-18 34"/>
</g></svg>'''

def widget(s):
    w = s.get("widget")
    if not w: return ""
    cta = s["cta"]
    if w == "simulador-expressao":
        body = f'''<div class="two" data-sim="expressao"><div>{face_svg()}</div><div><h3>Como a suavização aparece no rosto</h3><p class="sub">Ilustração interativa: arraste para ver o que significa "suavizar" linhas de expressão. Não é simulação do seu rosto nem previsão de resultado.</p>
<label for="sim-r" class="small">Antes → suavizado</label><input id="sim-r" class="range" type="range" min="0" max="100" value="0">
<p class="sim-out" style="background:var(--mint);padding:12px 14px;border-radius:12px"></p>
{wa(cta, "Agendar avaliação facial")}
<p class="disc">Linhas na testa, entre as sobrancelhas e ao lado dos olhos são as regiões mais comuns da toxina botulínica. Cada rosto pede uma avaliação individual com a Dra. Catiucia.</p></div></div>'''
    elif w == "implante":
        before = '''<svg viewBox="0 0 400 300" class="layer" aria-hidden="true"><rect width="400" height="300" fill="#FBF4F1"/><path d="M40 170 q160-70 320 0" stroke="#D99A9A" stroke-width="26" fill="none" stroke-linecap="round"/>''' + "".join(f'<rect x="{70+i*34}" y="{128 if i in (0,8) else 118}" width="26" height="{46 if i in (0,8) else 56}" rx="8" fill="#FBFAF4" stroke="#DDD5C4"/>' for i in range(9) if i != 4) + '''</svg>'''
        after = '''<svg viewBox="0 0 400 300" class="layer after" aria-hidden="true"><rect width="400" height="300" fill="#F1F8F5"/><path d="M40 170 q160-70 320 0" stroke="#E8A4A4" stroke-width="26" fill="none" stroke-linecap="round"/>''' + "".join(f'<rect x="{70+i*34}" y="{128 if i in (0,8) else 118}" width="26" height="{46 if i in (0,8) else 56}" rx="8" fill="#FFFFFF" stroke="#CFE0D8"/>' for i in range(9)) + '''<rect x="206" y="176" width="22" height="40" rx="6" fill="#9FB7B0"/><circle cx="217" cy="222" r="10" fill="#7C9A92"/></svg>'''
        rules = json.dumps({
            "1": "Um dente faltando: o caso clássico de implante unitário com coroa. A avaliação confirma osso e gengiva.",
            "varios": "Vários dentes: pode ser implantes individuais ou prótese fixa sobre implantes. O planejamento digital compara as opções.",
            "todos": "Todos os dentes de uma arcada: a prótese protocolo (fixa sobre implantes) é a alternativa à prótese móvel que solta.",
            "default": "A avaliação com planejamento digital é o próximo passo."}, ensure_ascii=False)
        body = f'''<div class="two"><div><h3>Antes e depois, em ilustração</h3><p class="sub">Arraste a barra. Ilustração didática, não um caso real.</p>
<div class="ba">{before}{after}<div class="handle"><i>⇆</i></div><span class="lbl l">Sem o dente</span><span class="lbl r">Com implante</span><input type="range" min="0" max="100" value="50" aria-label="Comparar antes e depois"></div><p class="small muted" style="margin-top:10px">Esquerda: espaço sem o dente, vizinhos tendem a inclinar. Direita: implante com coroa, espaço preenchido e mastigação de volta.</p></div>
<div class="quiz" data-cta="{e(cta)}" data-rules='{e(rules)}'><h3>Qual é o meu caso?</h3><p class="sub">Três perguntas para a recepção já te orientar.</p><div class="prog"><i></i></div>
<div class="q on"><b>Quantos dentes faltam?</b><div class="opts"><button data-v="1">Só 1</button><button data-v="varios">Vários</button><button data-v="todos">Todos (uso prótese)</button></div></div>
<div class="q"><b>Usa prótese móvel hoje?</b><div class="opts"><button data-v="protese sim">Sim</button><button data-v="protese nao">Não</button></div></div>
<div class="q"><b>Há quanto tempo está assim?</b><div class="opts"><button data-v="menos de 1 ano">Menos de 1 ano</button><button data-v="1 a 5 anos">1 a 5 anos</button><button data-v="mais de 5 anos">Mais de 5 anos</button></div></div>
<div class="res"><p class="txt"></p><a class="btn btn-wa" href="#">{WA_ICON}Enviar minhas respostas e agendar</a></div></div></div>'''
    elif w == "triagem-dor":
        rules = json.dumps({
            "inchaco sim": "Inchaço ou febre indicam infecção: procure atendimento hoje. Avise a recepção que há inchaço; esses casos têm prioridade.",
            "inchaco nao|hoje": "Dor recente sem inchaço: vale avaliar nos próximos dias para evitar que evolua. Peça um encaixe.",
            "inchaco nao|dias": "Dor há alguns dias sem melhora: a causa precisa ser tratada. Peça um encaixe.",
            "inchaco nao|semana": "Dor persistente há mais de uma semana costuma indicar inflamação do nervo. Não adie a avaliação.",
            "default": "Peça um encaixe pelo WhatsApp e conte o que sente."}, ensure_ascii=False)
        body = f'''<div class="quiz" data-cta="{e(cta)}" data-rules='{e(rules)}'><h3>Triagem rápida da dor</h3><p class="sub">Duas perguntas que a recepção faria. Não substitui a avaliação.</p><div class="prog"><i></i></div>
<div class="q on"><b>Tem inchaço no rosto ou na gengiva, ou febre?</b><div class="opts"><button data-v="inchaco sim">Sim</button><button data-v="inchaco nao">Não</button></div></div>
<div class="q"><b>Há quanto tempo dói?</b><div class="opts"><button data-v="hoje">Começou hoje</button><button data-v="dias">Alguns dias</button><button data-v="semana">Mais de uma semana</button></div></div>
<div class="res"><p class="txt"></p><a class="btn btn-wa" href="#">{WA_ICON}Pedir encaixe agora</a></div></div>'''
    elif w == "checklist-urgencia":
        itens = ["Dente da frente", "Está doendo", "Tenho o pedaço do dente", "Está sangrando", "Foi uma pancada ou queda", "Caiu uma restauração"]
        body = f'''<div class="chk-wa"><h3>Me conte o que aconteceu</h3><p class="sub">Marque o que se aplica. A mensagem para a recepção já vai preenchida.</p><div class="chk">{"".join(f'<label><input type="checkbox"> {e(i)}</label>' for i in itens)}</div><p style="margin-top:16px"><a class="btn btn-wa" data-chk-cta="{e(cta)}" href="#" target="_blank" rel="noopener">{WA_ICON}Enviar e pedir encaixe</a></p></div>'''
    elif w == "primeiro-dentinho":
        body = f'''<div class="calc" data-calc="dentinho"><h3>Quando levar meu bebê ao dentista?</h3><p class="sub">Digite a idade em meses e veja a orientação para essa fase.</p><label class="small" for="meses">Idade do bebê (meses)</label><br><input id="meses" type="number" min="0" max="144" value="8"><div class="out"></div><p style="margin-top:14px">{wa(cta, "Agendar a primeira visita")}</p><p class="disc">Base: recomendações das sociedades de odontopediatria (primeira visita até 1 ano). Orientação geral; a Dra. avalia cada criança.</p></div>'''
    elif w == "comparar-orto":
        body = f'''<div class="cmp"><div class="opt on" data-k="fixo"><b>Aparelho fixo</b><span class="small">Braquetes colados aos dentes, ajustados nas manutenções.</span></div><div class="opt" data-k="alin"><b>Alinhador invisível</b><span class="small">Placas transparentes removíveis, trocadas em sequência.</span></div>
<table><tbody>
<tr><td>Aparência</td><td data-k="fixo">Visível (metálico ou estético)</td><td data-k="alin">Quase imperceptível</td></tr>
<tr><td>Para comer</td><td data-k="fixo">Com restrições de alimentos</td><td data-k="alin">Sem restrição: a placa sai</td></tr>
<tr><td>Higiene</td><td data-k="fixo">Exige mais cuidado</td><td data-k="alin">Escova normalmente</td></tr>
<tr><td>Disciplina</td><td data-k="fixo">Não depende do uso</td><td data-k="alin">Usar ~22 h por dia</td></tr>
<tr><td>Casos</td><td data-k="fixo">Todos, inclusive complexos</td><td data-k="alin">Leves a moderados (avaliar)</td></tr>
<tr><td>Manutenção</td><td data-k="fixo">A cada 4 a 6 semanas</td><td data-k="alin">A cada 6 a 10 semanas</td></tr>
</tbody></table><p style="margin-top:16px">{wa(cta, "Avaliar qual é o melhor para mim")}</p><p class="disc">Clique em uma opção para destacar. A indicação final é da Dra. Catiucia, na avaliação.</p></div>'''
    elif w == "escala-clareamento":
        body = f'''<div><h3>Escala de tons, em ilustração</h3><p class="sub">Arraste para ver a lógica do clareamento. Não é previsão do seu resultado.</p><div class="shade"></div><input class="range shade-range" type="range" min="0" max="7" value="1" aria-label="Tom"><p class="shade-lbl" style="background:var(--mint);padding:12px 14px;border-radius:12px"></p>{wa(cta, "Agendar avaliação para clareamento")}<p class="disc">Restaurações e facetas não clareiam. O tom final depende do esmalte de cada pessoa e do protocolo supervisionado.</p></div>'''
    else:
        return ""
    return f'<section class="sand" id="ferramenta"><div class="wrap"><div class="widget">{body}</div></div></section>'

# ---------------------------------------------------------------- páginas
def service_page(s):
    crumbs = [("Início", DOM + "/"), (s["menu"], f"{DOM}/{s['slug']}")]
    lds = [ld_business(), ld_service(s), ld_faq(s["faq"]), ld_crumbs(crumbs)]
    para = "".join(f'<div class="card-s"><h3>{e(t)}</h3><p>{e(d)}</p></div>' for t, d in s["para_quem"])
    como = "".join(f'<div class="step"><h3>{e(t)}</h3><p>{e(d)}</p></div>' for t, d in s["como"])
    sinais = "".join(f'<li>{e(i)}</li>' for i in s["sinais"])
    faq = "".join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in s["faq"])
    rel = "".join(f'<div class="card-s"><div class="ico">{ICONS[GRUPO_ICON.get(BY_SLUG[r]["grupo"], "tooth")]}</div><h3>{e(BY_SLUG[r]["menu"])}</h3><p>{e(BY_SLUG[r]["lede"][:120])}…</p><a class="more" href="/{r}">Ver página →</a></div>' for r in s["relacionados"])
    aviso = f'<p class="aviso" style="margin-top:18px">{e(s["aviso"])}</p>' if s.get("aviso") else ""
    return head(s["title"], s["description"], s["slug"], lds) + header(s["slug"]) + f'''
<main>
<section class="hero"><div class="wrap">
<div class="crumbs"><a href="/">Início</a> › {e(s["grupo"])} › {e(s["menu"])}</div>
<span class="eyebrow">{e(s["grupo"])} · Brusque</span>
<h1>{e(s["h1"])}</h1>
<p class="lede" style="margin-top:16px">{e(s["lede"])}</p>
<div class="acts" style="display:flex;flex-wrap:wrap;gap:12px;margin-top:22px">{wa(s["cta"], s["cta_label"])}<a class="btn btn-ghost" href="#faq">Perguntas frequentes</a></div>
{aviso}
</div></section>

<section class="alt"><div class="wrap"><div class="sec-head"><span class="eyebrow">Para quem é</span><h2>Quando procurar</h2></div><div class="cards">{para}</div></div></section>

{widget(s)}

<section><div class="wrap"><div class="sec-head"><span class="eyebrow">Como funciona na Especitá</span><h2>Passo a passo</h2></div><div class="steps">{como}</div></div></section>

<section class="alt"><div class="wrap"><div class="two"><div><span class="eyebrow">{e(s["sinais_titulo"])}</span><ul class="list-check" style="margin-top:12px">{sinais}</ul></div><div>{dra_box()}</div></div></div></section>

<section id="faq"><div class="wrap"><div class="sec-head"><span class="eyebrow">Perguntas frequentes</span><h2>{e(s["menu"])} em Brusque: dúvidas comuns</h2></div><div class="faq">{faq}</div></div></section>

{cta_band(s["cta"], s["cta_label"])}

<section class="alt"><div class="wrap"><div class="sec-head"><span class="eyebrow">Veja também</span><h2>Outros cuidados na Especitá</h2></div><div class="cards">{rel}</div></div></section>
{local_block()}
</main>''' + footer()

def home_page():
    lds = [ld_business(), {"@context": "https://schema.org", "@type": "WebSite", "name": SITE["nome"], "url": DOM + "/"}]
    cards = "".join(f'<div class="card-s"><div class="ico">{ICONS[GRUPO_ICON.get(s["grupo"], "tooth")]}</div><h3>{e(s["menu"])}</h3><p>{e(s["lede"].split(". ")[0])}.</p><a class="more" href="/{s["slug"]}">Saiba mais →</a></div>' for s in SERVICOS)
    trust = "".join(f'<div><b>{e(n)}</b>{e(t)}</div>' for n, t in HOME["destaques"])
    return head(HOME["title"], HOME["description"], "", lds) + header("") + f'''
<main>
<section class="hero"><div class="wrap"><div class="grid">
<div><span class="eyebrow">Clínica odontológica em Brusque · Santa Rita</span>
<h1>{e(HOME["h1"])}</h1>
<p class="lede" style="margin-top:16px">{e(HOME["lede"])}</p>
<div class="acts">{wa(HOME["cta"], "Agendar pelo WhatsApp")}<a class="btn btn-ghost" href="#servicos">Ver serviços</a></div>
<div class="trust">{trust}</div></div>
<div class="hero-art"><div class="blob"></div><div class="photo">Foto da Dra. Catiucia<br>(substituir)</div><div class="card c1"><b>Encaixe de urgência</b>todos os dias</div><div class="card c2"><b>Família no mesmo dia</b>horários em sequência</div><div class="card c3"><b>{e(SITE["cro"])}</b>{e(SITE["dra"])}</div></div>
</div></div></section>

<section class="alt" id="servicos"><div class="wrap"><div class="sec-head"><span class="eyebrow">Serviços</span><h2>Tudo o que a sua família precisa, no mesmo lugar</h2></div><div class="cards">{cards}</div></div></section>

<section class="sand"><div class="wrap"><div class="two"><div><span class="eyebrow">Como funciona</span><h2>Do primeiro contato à manutenção, com a mesma profissional</h2><p class="lede" style="margin-top:14px">Você chama no WhatsApp, a recepção responde rápido e oferece dois horários. Na avaliação, a Dra. Catiucia explica o que vê em linguagem simples e monta o plano com você. Depois, lembretes de revisão a cada 6 meses.</p></div>
<div class="steps"><div class="step"><h3>Chame no WhatsApp</h3><p>Conte o que precisa. Resposta em minutos no horário de atendimento.</p></div><div class="step"><h3>Avaliação completa</h3><p>Exame, fotos e radiografias quando necessário. Plano explicado sem pressa.</p></div><div class="step"><h3>Tratamento e revisão</h3><p>Em etapas, no seu ritmo. Lembrete de revisão pelo WhatsApp.</p></div></div></div></div></section>

<section><div class="wrap"><div class="two"><div>{dra_box()}</div><div><span class="eyebrow">Urgência</span><h2>Dor de dente ou dente quebrado?</h2><p class="lede" style="margin-top:12px">A Especitá reserva encaixes de urgência de segunda a sábado. Chame no WhatsApp e conte o que aconteceu.</p><div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:16px"><a class="btn btn-sand" href="/dor-de-dente">Dor de dente</a><a class="btn btn-sand" href="/dente-quebrado">Dente quebrado</a></div></div></div></div></section>

{cta_band(HOME["cta"], "Agendar pelo WhatsApp")}
{local_block()}
</main>''' + footer()

def sobre_page():
    lds = [ld_business(), {"@context": "https://schema.org", "@type": "Person", "name": SITE["dra"], "jobTitle": "Cirurgiã-dentista", "identifier": SITE["cro"], "worksFor": {"@id": DOM + "/#clinica"}, "url": DOM + "/sobre"}]
    texto = "".join(f"<p>{e(t)}</p>" for t in SOBRE["texto"])
    return head(SOBRE["title"], SOBRE["description"], "sobre", lds) + header("") + f'''
<main><section class="hero"><div class="wrap"><div class="grid"><div><span class="eyebrow">A Dra.</span><h1>{e(SOBRE["h1"])}</h1><p class="lede" style="margin-top:12px">{e(SITE["cro"])} · {e(SITE["epao"])}</p><div style="margin-top:20px;font-size:17px">{texto}<p class="aviso">{e(SOBRE["formacao_placeholder"])}</p></div><div class="acts" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:18px">{wa(HOME["cta"], "Agendar avaliação")}</div></div><div class="hero-art"><div class="blob"></div><div class="photo">Foto da Dra. Catiucia<br>(substituir)</div></div></div></div></section>
{local_block()}</main>''' + footer()

def contato_page():
    lds = [ld_business(), ld_crumbs([("Início", DOM + "/"), ("Contato", DOM + "/contato")])]
    return head("Contato e como chegar | Especitá Odontologia · Brusque", "WhatsApp, endereço, horário e como chegar à Especitá Odontologia e Estética, no Santa Rita, em Brusque, em frente à ponte dos bombeiros.", "contato", lds) + header("") + f'''
<main><section class="hero"><div class="wrap"><span class="eyebrow">Contato</span><h1>Fale com a Especitá</h1><p class="lede" style="margin-top:12px">O jeito mais rápido é o WhatsApp. Conte o que você precisa e a recepção responde com os horários disponíveis.</p><div class="acts" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:18px">{wa(HOME["cta"], "Chamar no WhatsApp")}<a class="btn btn-ghost" href="{SITE["instagram"]}" target="_blank" rel="noopener">Instagram</a></div></div></section>
{local_block()}
<section><div class="wrap"><div class="sec-head"><span class="eyebrow">Antes de vir</span><h2>O que trazer na primeira consulta</h2></div><ul class="list-check"><li>Documento com foto.</li><li>Exames, radiografias ou orçamentos anteriores, se tiver.</li><li>Lista de medicamentos em uso.</li><li>Carteirinha do convênio, se for o caso (confirme o atendimento pelo WhatsApp).</li></ul></div></section></main>''' + footer()

LEGAL_PRIV = f'''<h2>Quem somos</h2><p>{SITE["nome"]}, responsável técnica {SITE["dra"]} ({SITE["cro"]}), com sede na {SITE["endereco"]}. [CNPJ: preencher]</p>
<h2>Quais dados coletamos</h2><p>Ao entrar em contato pelo WhatsApp ou formulários, coletamos nome, telefone, mensagem enviada e, quando você informa, dados sobre o atendimento desejado. Ao navegar, podem ser coletados dados de uso por ferramentas de medição (Google Analytics, Meta Pixel), conforme sua configuração de cookies.</p>
<h2>Para que usamos</h2><p>Para responder ao seu contato, agendar e confirmar consultas, enviar lembretes e, com o seu consentimento, comunicações sobre a clínica. Dados de saúde são tratados apenas no contexto do atendimento odontológico, com sigilo profissional.</p>
<h2>Com quem compartilhamos</h2><p>Com provedores necessários à operação (Meta/WhatsApp Business, hospedagem, ferramentas de agenda e medição), sempre limitados à finalidade. Não vendemos dados.</p>
<h2>Seus direitos (LGPD)</h2><p>Você pode solicitar acesso, correção, exclusão ou portabilidade dos seus dados, e revogar consentimentos, pelo WhatsApp {SITE["whatsapp_fmt"]} ou pelo e-mail [preencher]. Para sair das comunicações, responda SAIR a qualquer mensagem.</p>
<h2>Retenção e segurança</h2><p>Dados de atendimento são mantidos pelo prazo exigido pelas normas odontológicas e fiscais. Adotamos medidas técnicas e organizacionais para proteger as informações.</p>
<p class="small">Última atualização: {TODAY}.</p>'''
LEGAL_TERMS = f'''<h2>Uso do site</h2><p>O conteúdo deste site é informativo e educativo. Não substitui consulta, diagnóstico ou tratamento com profissional habilitado. Resultados de tratamentos variam de pessoa para pessoa.</p>
<h2>Agendamentos</h2><p>Horários solicitados pelo WhatsApp são confirmados pela recepção. Cancelamentos e remarcações devem ser avisados com antecedência pelo mesmo canal.</p>
<h2>Propriedade intelectual</h2><p>Textos, ilustrações e marca pertencem à {SITE["nome"]}. Ilustrações interativas são didáticas e não representam casos reais ou previsões de resultado.</p>
<h2>Responsabilidade profissional</h2><p>Responsável técnica: {SITE["dra"]}, {SITE["cro"]}. Publicidade conforme o Código de Ética Odontológica.</p>
<p class="small">Última atualização: {TODAY}.</p>'''

def legal_page(slug, title, body):
    return head(f"{title} | Especitá", f"{title} da Especitá Odontologia e Estética, Brusque.", slug, [ld_business()]) + header("") + f'''<main><section class="hero"><div class="wrap" style="max-width:760px"><h1>{e(title)}</h1><div style="margin-top:20px;font-size:16px">{body}</div></div></section></main>''' + footer()

# ---------------------------------------------------------------- arquivos auxiliares
def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
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
    write("vercel.json", json.dumps({"cleanUrls": True, "trailingSlash": False, "headers": [{"source": "/(.*)", "headers": [{"key": "X-Content-Type-Options", "value": "nosniff"}, {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"}]}]}, indent=2))
    write("assets/img/favicon.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0E7C6B"/><text x="32" y="44" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="36" fill="#fff">E</text></svg>')
    print("ok:", len(pages), "páginas em", ROOT)

if __name__ == "__main__":
    build()
