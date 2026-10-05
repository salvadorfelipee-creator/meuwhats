# -*- coding: utf-8 -*-
"""Estrutura completa das campanhas novas de Pesquisa do Google Ads da Especitá.

Gera:
  07-GOOGLE-ADS-ESTRUTURA.md   -> documento legível (o que criar, por quê, como testar)
  07-google-ads-import.csv     -> importação em massa (Google Ads Editor / Ferramentas > Uploads)

Regras aplicadas em todo texto (CFO Res. 196/2019 + 271/2025 + política de saúde do Google):
  sem preço, parcelamento, "grátis", promoção, desconto, garantia, superlativo, depoimento,
  antes/depois; nome + CRO em toda descrição. Sem "24 horas" como promessa (a clínica não abre 24h).

Rodar:  python 07-GOOGLE-ADS.build.py
"""
import csv, io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "https://clinicaespecita.com"   # site atual (WordPress, uma página). Trocar pelas páginas por serviço quando publicadas.
CRO = "Dra. Catiucia, CRO-SC 14067."  # vai só na descrição 1 (fixada na posição 1)
PHONE = "+55 47 99778-9519"

# ---------------------------------------------------------------------------
# Negativas (lista compartilhada "ESP · Negativas gerais", aplicada em todas as campanhas)
# ---------------------------------------------------------------------------
NEG_GERAIS = [
    "grátis", "gratuito", "de graça", "sus", "ubs", "posto de saúde", "curso", "faculdade",
    "técnico", "auxiliar", "asb", "tsb", "vaga", "emprego", "salário", "quanto ganha", "concurso",
    "estágio", "residência", "cursos", "apostila", "pdf", "youtube", "wikipedia", "significado",
    "o que é", "caseiro", "em casa", "receita", "bicarbonato", "plano odontológico", "convênio barato",
    "odontocompany", "oral sin", "sorridents", "sorriso certo", "uniodonto", "amil dental",
    "blumenau", "itajaí", "balneário", "joinville", "florianópolis", "gaspar", "indaial", "timbó",
    "veterinário", "cachorro", "gato", "dentista 24 horas",  # ver nota: "24 horas" só na Urgência
]
# Observação: cidades vizinhas ficam negativas nas campanhas de rotina; a campanha de Implante usa
# raio maior e NÃO leva as negativas de cidade (lista própria abaixo).
NEG_IMPLANTE_EXTRA = ["barato", "mais barato", "preço", "valor", "quanto custa", "tabela"]
NEG_SEM_CIDADES = [n for n in NEG_GERAIS if n not in ("blumenau", "itajaí", "balneário", "gaspar", "indaial", "timbó", "dentista 24 horas")]

# ---------------------------------------------------------------------------
# Extensões (recursos) compartilhadas
# ---------------------------------------------------------------------------
SITELINKS = [
    ("Encaixe de urgência",      "Dente quebrado ou dor de dente", "Atendimento no mesmo dia",      f"{BASE}/"),
    ("Implante dentário",        "Avaliação com planejamento",     "Prótese fixa sobre implantes",  f"{BASE}/"),
    ("Ortodontia e alinhador",   "Aparelho fixo ou invisível",     "Acompanhamento em Brusque",     f"{BASE}/"),
    ("Dentista para crianças",   "Primeira visita de adaptação",   "Odontopediatria em Brusque",    f"{BASE}/"),
    ("Clareamento dental",       "Personalizado pela Dra.",        "Moldeira feita para você",      f"{BASE}/"),
    ("Como chegar",              "Rua Sete de Setembro, 55",       "Em frente à ponte dos bombeiros", f"{BASE}/"),
]
CALLOUTS = [
    "Encaixe de urgência", "Planejamento digital", "10 anos em Brusque", "Atendimento por WhatsApp",
    "Sábado pela manhã", "Em frente à ponte dos bombeiros"[:25], 
]
SNIPPET = ("Serviços", ["Implante dentário", "Ortodontia", "Alinhador invisível", "Clareamento", "Odontopediatria",
                        "Lente de contato", "Harmonização facial", "Urgência"])

# ---------------------------------------------------------------------------
# Campanhas
# ---------------------------------------------------------------------------
# Cada campanha: nome, orçamento/dia, local, destino (forma de contato), programação, grupos.
# Cada grupo: nome, palavras [(texto, tipo)], URL final, caminhos, 15 títulos, 4 descrições, pins.
# Tipos: "frase" ou "exata". Não usamos ampla no início (sem conversões suficientes para o Smart Bidding).

def rsa(h, d, pins=None, dpins=None):
    return {"headlines": h, "descriptions": d, "pins": pins or {}, "dpins": dpins or {}}

CAMPANHAS = [
    # ------------------------------------------------------------------ 1
    dict(
        nome="ESP - Urgência", local_upload="Brusque,State of Santa Catarina,Brazil;", orcamento=15.00, status="Ativada",
        local="Somente a cidade de Brusque (presença física), sem raio e sem cidades vizinhas", raio="pedido do Salvador em 05/10: a cidade é vertical, raio pega lugar longe",
        contato="WhatsApp + ligação (sem formulário: urgência é velocidade). Recurso de chamada ativo só no horário da clínica.",
        programacao="Seg–sex 7h–20h, sáb 7h–13h (fora disso ninguém responde; não gastar). Lance +20% 11h–14h e 17h–20h.",
        publicos="Observação: nenhum no início (urgência não tem público; a palavra já é a intenção).",
        meta="≤ R$ 25 por conversa; ≥ 50% viram consulta no mesmo dia.",
        teste="T1 (14 dias): grupo Dente quebrado x grupo Dor de dente, qual converte mais barato. T2: anúncio com 'hoje' x anúncio com 'Dra. há 10 anos'.",
        grupos=[
            dict(nome="Dente quebrado",
                 kws=[("dente quebrado dentista", "frase"), ("quebrei o dente", "frase"), ("dentista urgência brusque", "frase"),
                      ("dentista urgencia", "frase"), ("dentista hoje brusque", "exata"), ("restauração dente quebrado", "frase"),
                      ("dente quebrou o que fazer", "frase"), ("dentista 24 horas brusque", "exata"), ("dentista emergência brusque", "frase")],
                 url=f"{BASE}/", path=("urgencia", "dente-quebrado"),
                 ad=rsa([
                     "Quebrou o Dente? Encaixe Hoje",      # 1
                     "Urgência Dentária em Brusque",       # 2
                     "Dentista de Urgência Brusque",    # 3
                     "Encaixe de Urgência Hoje",   # 4
                     "Chame no WhatsApp e Conte",          # 5
                     "Dra. Catiucia · CRO-SC 14067",       # 6
                     "Dente Quebrado Tem Solução",         # 7
                     "Frente à Ponte dos Bombeiros",    # 8
                     "Atendimento de Seg a Sáb",   # 9
                     "Restauração de Dente Quebrado",      # 10
                     "Mais de 10 Anos em Brusque",         # 11
                     "Vaga Reservada Para Urgência",    # 12
                     "Dentista em Brusque Santa Rita",     # 13
                     "Resposta Rápida no WhatsApp",  # 14
                     "Especitá Odontologia Brusque",       # 15
                 ], [
                     f"Quebrou o dente? Encaixe de urgência hoje em Brusque. {CRO}",
                     f"Chame no WhatsApp, conte o que aconteceu e receba dois horários para hoje.",
                     f"Dente quebrado, trincado ou solto: avaliação no mesmo dia, frente à ponte dos bombeiros.",
                     f"Clínica em Brusque há mais de 10 anos. Primeiro o alívio, depois o plano.",
                 ], pins={1: 1}, dpins={1: 1})),
            dict(nome="Dor de dente",
                 kws=[("dor de dente dentista", "frase"), ("dentista dor de dente brusque", "frase"), ("dentista perto de mim", "frase"),
                      ("dentista aberto agora", "frase"), ("canal de dente brusque", "frase"), ("extração de dente brusque", "frase"),
                      ("dor de dente o que fazer", "frase"), ("dente inflamado dentista", "frase"), ("dentista agora brusque", "exata")],
                 url=f"{BASE}/", path=("urgencia", "dor-de-dente"),
                 ad=rsa([
                     "Dor de Dente? Encaixe Hoje",
                     "Dentista Para Dor de Dente",
                     "Urgência Dentária em Brusque",
                     "Atendimento no Mesmo Dia",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Dor Que Não Passa Com Remédio",
                     "Chame no WhatsApp Agora",
                     "Frente à Ponte dos Bombeiros",
                     "Canal e Extração em Brusque",
                     "Dentista Perto de Você",
                     "Mais de 10 Anos em Brusque",
                     "Primeiro a Dor, Depois o Plano",
                     "Encaixe de Urgência Reservado",
                     "Atendimento Seg a Sáb",
                     "Especitá Odontologia Brusque",
                 ], [
                     f"Dor de dente que não passa? Encaixe no mesmo dia em Brusque. {CRO}",
                     f"Chame no WhatsApp, diga há quanto tempo dói e receba dois horários para hoje.",
                     f"Canal, extração e tratamento da dor em Brusque, em frente à ponte dos bombeiros.",
                     f"A Dra. atende urgências em Brusque há mais de 10 anos. Primeiro a dor, depois o plano.",
                 ], pins={1: 1}, dpins={1: 1})),
        ]),
    # ------------------------------------------------------------------ 2
    dict(
        nome="ESP - Implante e Prótese", local_upload="Brusque,State of Santa Catarina,Brazil;", orcamento=20.00, status="Ativada",
        local="Somente a cidade de Brusque (presença física), sem raio e sem cidades vizinhas", raio="pedido do Salvador em 05/10: a cidade é vertical, raio pega lugar longe",
        contato="Página de implante + WhatsApp (principal) + formulário de lead do Google (teste). Ligação ativa. Qualificação acontece no WhatsApp: quantos dentes faltam, usa prótese, há quanto tempo, bairro.",
        programacao="Seg–sex 7h–21h, sáb 7h–14h. Sem ajuste de lance no início.",
        publicos="Observação: Em mercado 'Serviços odontológicos' (se existir); Demografia detalhada 'Pais de adolescentes' NÃO (fora do perfil). Depois de 30 dias: lista de clientes (pacientes) como exclusão.",
        meta="≤ R$ 25 por conversa; ≤ R$ 120 por avaliação; decide o custo por paciente fechado.",
        teste="T1: grupo Implante x grupo Prótese protocolo (qual termo traz o paciente certo). T2 (a partir da semana 3): formulário do Google x WhatsApp, pela taxa de comparecimento.",
        negativas_extra=NEG_IMPLANTE_EXTRA, sem_cidades=True,
        grupos=[
            dict(nome="Implante dentário",
                 kws=[("implante dentário brusque", "frase"), ("implantes dentarios", "frase"), ("implante dentário", "exata"),
                      ("dentista de implante", "frase"), ("implante de dente", "frase"), ("implante dente da frente", "frase"),
                      ("clínica de implante dentário", "frase"), ("implantodontista brusque", "frase"), ("colocar implante dentário", "frase")],
                 url=f"{BASE}/", path=("implante", "brusque"),
                 ad=rsa([
                     "Implante Dentário em Brusque",
                     "Está Faltando Dentes?",
                     "Dentista de Implante Brusque",
                     "Avaliação Com Planejamento",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Volte a Mastigar de Tudo",
                     "Implante de Um ou Mais Dentes",
                     "Planejamento Digital do Caso",
                     "Frente à Ponte dos Bombeiros",
                     "Mais de 10 Anos em Brusque",
                     "Agende Pelo WhatsApp",
                     "Etapas Explicadas Sem Pressa",
                     "Implante Dentário Santa Rita",
                     "Dente da Frente ou de Trás",
                     "Especitá Odontologia Brusque",
                 ], [
                     f"Falta um dente ou vários? Avaliação com planejamento digital. {CRO}",
                     f"Implante dentário em Brusque, em frente à ponte dos bombeiros. Agende pelo WhatsApp.",
                     f"Mastigar de tudo de novo e sorrir sem esconder: a avaliação mostra se o seu caso pode.",
                     f"Clínica em Brusque há mais de 10 anos. Implante para um dente, vários ou toda a arcada.",
                 ], pins={1: 1}, dpins={1: 1})),
            dict(nome="Prótese protocolo",
                 kws=[("prótese protocolo", "frase"), ("protocolo dentário", "frase"), ("prótese fixa sobre implante", "frase"),
                      ("prótese dentária brusque", "frase"), ("dentadura fixa", "frase"), ("trocar prótese dentária", "frase"),
                      ("prótese total", "frase"), ("all on four", "frase"), ("prótese dentária fixa", "frase")],
                 url=f"{BASE}/", path=("protese", "protocolo"),
                 ad=rsa([
                     "Prótese Protocolo em Brusque",
                     "Prótese Que Solta Tem Solução",
                     "Prótese Fixa Sobre Implantes",
                     "Avaliação Com Planejamento",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Dentadura Que Não Sai do Lugar",
                     "Volte a Comer de Tudo",
                     "Protocolo Superior e Inferior",
                     "Frente à Ponte dos Bombeiros",
                     "Mais de 10 Anos em Brusque",
                     "Agende Pelo WhatsApp",
                     "Etapas Explicadas Sem Pressa",
                     "Prótese Dentária em Brusque",
                     "Hora de Trocar a Prótese?",
                     "Especitá Odontologia Brusque",
                 ], [
                     f"Prótese que solta e machuca? Está na hora de trocar. {CRO}",
                     f"Protocolo é a prótese fixa sobre implantes, que não sai. Etapas explicadas sem pressa.",
                     f"Clínica em Brusque, em frente à ponte dos bombeiros. Agende a avaliação pelo WhatsApp.",
                     f"Prótese móvel dura de 5 a 7 anos; depois afrouxa e fere a gengiva. Veja se pode ser fixa.",
                 ], pins={1: 1}, dpins={1: 1})),
        ]),
    # ------------------------------------------------------------------ 3
    dict(
        nome="ESP - Ortodontia", local_upload="Brusque,State of Santa Catarina,Brazil;", orcamento=10.00, status="Ativada",
        local="Somente a cidade de Brusque (presença física), sem raio e sem cidades vizinhas", raio="pedido do Salvador em 05/10: a cidade é vertical, raio pega lugar longe",
        contato="Página de ortodontia/alinhador + WhatsApp. Sem formulário (adulto decide rápido; pais perguntam no WhatsApp).",
        programacao="Seg–sex 7h–21h, sáb 7h–13h.",
        publicos="Observação: Demografia detalhada 'Pais de adolescentes (13–17)' no grupo Aparelho fixo; Em mercado 'Serviços odontológicos' se existir.",
        meta="< R$ 30 por conversa (Meta hoje gasta R$ 40 por lead). Se em 14 dias não bater, pausar a Meta e deixar ortodontia só aqui.",
        teste="T1: Alinhador (adulto) x Aparelho fixo (pais) — qual grupo traz conversa mais barata e qual agenda mais.",
        grupos=[
            dict(nome="Alinhador invisível",
                 kws=[("alinhador invisível brusque", "frase"), ("alinhador invisível", "frase"), ("aparelho invisível", "frase"),
                      ("invisalign brusque", "frase"), ("alinhador transparente", "frase"), ("aparelho transparente dentista", "frase"),
                      ("ortodontia invisível", "frase"), ("alinhador dental", "frase")],
                 url=f"{BASE}/", path=("ortodontia", "alinhador"),
                 ad=rsa([
                     "Alinhador Invisível em Brusque",
                     "O Aparelho Que Ninguém Vê",
                     "Alinhe os Dentes Sem Metal",
                     "Avaliação Com Planejamento",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Acompanhamento em Brusque",
                     "Sai Para Comer e Escovar",
                     "Seu Caso Pode Usar Alinhador?",
                     "Frente à Ponte dos Bombeiros",
                     "Mais de 10 Anos em Brusque",
                     "Agende Pelo WhatsApp",
                     "Ortodontia Para Adultos",
                     "Alinhador Transparente",
                     "Discreto Para Reuniões e Fotos",
                     "Especitá Odontologia Brusque",
                 ], [
                     f"Alinhador invisível: dentes alinhados sem metal, em Brusque. {CRO}",
                     f"Quer saber se o seu caso pode? Avaliação com planejamento digital. Agende pelo WhatsApp.",
                     f"Ortodontia para adultos em Brusque, frente à ponte dos bombeiros. Discreto nas reuniões.",
                     f"Sai para comer e escovar. Alinhador ou aparelho fixo: a avaliação mostra o caminho certo.",
                 ], pins={1: 1}, dpins={1: 1})),
            dict(nome="Aparelho fixo",
                 kws=[("aparelho ortodôntico brusque", "frase"), ("ortodontista brusque", "frase"), ("aparelho nos dentes", "frase"),
                      ("colocar aparelho", "frase"), ("aparelho fixo", "frase"), ("aparelho dentário", "frase"),
                      ("dentista aparelho brusque", "frase"), ("ortodontia brusque", "frase"), ("aparelho para adolescente", "frase")],
                 url=f"{BASE}/", path=("ortodontia", "brusque"),
                 ad=rsa([
                     "Aparelho Ortodôntico Brusque",
                     "Ortodontista em Brusque",
                     "Quando Começar o Aparelho?",
                     "Avaliação Ortodôntica",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Aparelho Fixo ou Alinhador",
                     "Acompanhamento Perto de Casa",
                     "Para Adolescentes e Adultos",
                     "Frente à Ponte dos Bombeiros",
                     "Mais de 10 Anos em Brusque",
                     "Agende Pelo WhatsApp",
                     "A Dra. Explica Cada Etapa",
                     "Ortodontia em Brusque",
                     "Dentes Tortos ou Apinhados",
                     "Especitá Odontologia Brusque",
                 ], [
                     f"Aparelho fixo ou alinhador? A avaliação mostra o caminho. {CRO}",
                     f"Ortodontia em Brusque com acompanhamento perto de casa, em frente à ponte dos bombeiros.",
                     f"Quando começar o aparelho do seu filho? Agende a avaliação pelo WhatsApp.",
                     f"Clínica em Brusque há mais de 10 anos. Aparelho para adolescentes e adultos.",
                 ], pins={1: 1}, dpins={1: 1})),
        ]),
    # ------------------------------------------------------------------ 4
    dict(
        nome="ESP - Odontopediatria", local_upload="Brusque,State of Santa Catarina,Brazil;", orcamento=8.00, status="Ativada",
        local="Somente a cidade de Brusque (presença física), sem raio e sem cidades vizinhas", raio="pedido do Salvador em 05/10: a cidade é vertical, raio pega lugar longe",
        contato="Página de odontopediatria + WhatsApp (mãe pergunta antes de agendar). Sem formulário.",
        programacao="Seg–sex 7h–21h, sáb 7h–13h. Lance +15% 20h–22h (mães pesquisam à noite).",
        publicos="Observação: Demografia detalhada 'Pais de bebês (0–1)', 'Pais de crianças pequenas (1–3)', 'Pais de pré-escolares (4–5)', 'Pais de crianças em idade escolar (6–12)'.",
        meta="≤ R$ 30 por conversa; ≥ 40% agendam; medir pacientes por conversa (família).",
        teste="T1: anúncio 'primeira visita de adaptação' x anúncio 'criança com medo'. Volume em Brusque é baixo: deixar sempre ligada com lance baixo.",
        grupos=[
            dict(nome="Dentista infantil",
                 kws=[("dentista infantil brusque", "frase"), ("dentista infantil", "frase"), ("odontopediatra brusque", "frase"),
                      ("odontopediatria brusque", "frase"), ("dentista para criança", "frase"), ("dentista de criança brusque", "frase"),
                      ("dentista para bebê", "frase"), ("primeira consulta dentista bebê", "frase"), ("criança com medo de dentista", "frase"),
                      ("odontopediatra", "exata")],
                 url=f"{BASE}/", path=("infantil", "brusque"),
                 ad=rsa([
                     "Dentista Infantil em Brusque",
                     "1ª Visita: Só Para Conhecer",
                     "Odontopediatria em Brusque",
                     "Visita de Adaptação Sem Trauma",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Dentista Para Bebês e Crianças",
                     "Criança Com Medo de Dentista?",
                     "Bebê no Dentista: Quando Levar",
                     "Frente à Ponte dos Bombeiros",
                     "Mais de 10 Anos em Brusque",
                     "Agende Pelo WhatsApp",
                     "Cantinho Infantil na Clínica",
                     "Dentista Para Toda a Família",
                     "Clube do Dente Corajoso",
                     "Especitá Odontologia Brusque",
                 ], [
                     f"Primeira visita de adaptação: sem procedimento, sem trauma. {CRO}",
                     f"Dentista para bebês e crianças em Brusque, em frente à ponte dos bombeiros.",
                     f"Com que idade levar o bebê ao dentista? Antes de 1 ano. Tire as dúvidas pelo WhatsApp.",
                     f"Criança com medo de dentista? A criança conhece a cadeira e o espelhinho, no ritmo dela.",
                 ], pins={1: 1}, dpins={1: 1})),
        ]),
    # ------------------------------------------------------------------ 5
    dict(
        nome="ESP - Clareamento e Lentes", local_upload="Brusque,State of Santa Catarina,Brazil;", orcamento=10.00, status="Ativada",
        local="Somente a cidade de Brusque (presença física), sem raio e sem cidades vizinhas", raio="pedido do Salvador em 05/10: a cidade é vertical, raio pega lugar longe",
        contato="Página do serviço + WhatsApp. Sem formulário.",
        programacao="Seg–sex 7h–21h, sáb 7h–13h. Clareamento: reforçar out–dez (festas) e abr–mai.",
        publicos="Observação: Eventos da vida 'Casamento em breve' (ambos os grupos); Em mercado 'Procedimentos estéticos' se existir.",
        meta="Clareamento ≤ R$ 26 por conversa (benchmark da Meta); Lentes ≤ R$ 150 por avaliação.",
        teste="T1: Clareamento 'para as festas' x 'personalizado x de farmácia'. Lentes: 'sorriso planejado' x 'dente pequeno ou espaçado'.",
        grupos=[
            dict(nome="Clareamento dental",
                 kws=[("clareamento dental brusque", "frase"), ("clareamento dental", "frase"), ("clareamento dentista", "frase"),
                      ("clarear os dentes", "frase"), ("clareamento a laser", "frase"), ("clareamento dentário brusque", "frase"),
                      ("dentes brancos dentista", "frase"), ("clareamento com moldeira", "frase")],
                 url=f"{BASE}/", path=("clareamento", "brusque"),
                 ad=rsa([
                     "Clareamento Dental em Brusque",
                     "Clareamento Personalizado",
                     "Sorriso Branco Para as Festas",
                     "Moldeira Feita Para Você",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Não É Clareamento de Farmácia",
                     "Resultado Uniforme e Natural",
                     "Avaliação do Tom dos Dentes",
                     "Frente à Ponte dos Bombeiros",
                     "Mais de 10 Anos em Brusque",
                     "Agende Pelo WhatsApp",
                     "Agenda de Dezembro Aberta",
                     "Clareamento Com Acompanhamento",
                     "Casamento, Formatura ou Fotos",
                     "Especitá Odontologia Brusque",
                 ], [
                     f"Clareamento personalizado com moldeira feita para a sua boca. {CRO}",
                     f"Diferente do clareamento de farmácia: acompanhamento da Dra. e resultado uniforme.",
                     f"Sorriso branco para casamento, formatura e festas de fim de ano. Clínica em Brusque.",
                     f"Clínica em Brusque há mais de 10 anos, frente à ponte dos bombeiros. Agende pelo WhatsApp.",
                 ], pins={1: 1}, dpins={1: 1})),
            dict(nome="Lente de contato dental",
                 kws=[("lente de contato dental brusque", "frase"), ("lente de contato dental", "frase"), ("lentes de contato dentais", "frase"),
                      ("faceta dental", "frase"), ("faceta de porcelana", "frase"), ("lente nos dentes", "frase"),
                      ("dentista estético brusque", "frase"), ("fechar espaço entre os dentes", "frase")],
                 url=f"{BASE}/", path=("lentes", "brusque"),
                 ad=rsa([
                     "Lente de Contato Dental",
                     "O Sorriso Planejado Pela Dra.",
                     "Lentes e Facetas em Brusque",
                     "Avaliação Com Planejamento",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Dente Pequeno ou Espaçado?",
                     "Sorriso Planejado em Digital",
                     "Veja Se o Seu Caso Pode",
                     "Frente à Ponte dos Bombeiros",
                     "Mais de 10 Anos em Brusque",
                     "Agende Pelo WhatsApp",
                     "Etapas Explicadas Sem Pressa",
                     "Estética Dental em Brusque",
                     "Facetas de Porcelana",
                     "Especitá Odontologia Brusque",
                 ], [
                     f"Lente de contato dental para dente pequeno ou espaçado. {CRO}",
                     f"A Dra. mostra a lente na mão e explica cada etapa, sem pressa. Clínica em Brusque.",
                     f"Lentes e facetas em Brusque, frente à ponte dos bombeiros. Agende a avaliação no WhatsApp.",
                     f"Avaliação com planejamento digital do sorriso: veja se o seu caso pode receber lentes.",
                 ], pins={1: 1}, dpins={1: 1})),
        ]),
    # ------------------------------------------------------------------ 6
    dict(
        nome="ESP - Harmonização Facial", local_upload="Brusque,State of Santa Catarina,Brazil;", orcamento=10.00, status="PAUSADA (criar pausada; ligar só após resposta do CRO-SC sobre o TRF1 de 19/08/2026)",
        local="Somente a cidade de Brusque (presença física), sem raio e sem cidades vizinhas", raio="pedido do Salvador em 05/10: a cidade é vertical, raio pega lugar longe",
        contato="Página de harmonização + WhatsApp + formulário de lead do Google (perguntas padrão apenas; nada de saúde). Ligação ativa.",
        programacao="Seg–sex 7h–21h, sáb 7h–13h.",
        publicos="Observação: Eventos da vida 'Casamento em breve'; Em mercado 'Procedimentos estéticos / Cuidados com a pele' se existir. Grupo masculino sem público.",
        meta="≤ R$ 17 por lead (benchmark Meta); decide pela taxa de comparecimento.",
        teste="T1: 'Botox' (palavra popular) x 'Harmonização' (termo técnico). T2: formulário x WhatsApp.",
        sem_cidades=True,
        grupos=[
            dict(nome="Botox",
                 kws=[("botox brusque", "frase"), ("botox dentista", "frase"), ("aplicação de botox", "frase"), ("botox facial", "frase"),
                      ("toxina botulínica brusque", "frase"), ("botox testa", "frase"), ("botox para homem", "frase"), ("clínica de botox brusque", "frase")],
                 url=f"{BASE}/", path=("harmonizacao", "botox"),
                 ad=rsa([
                     "Botox em Brusque Com a Dra.",
                     "O Que o Botox Faz e Não Faz",
                     "Aplicação de Botox em Brusque",
                     "Avaliação Facial Individual",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Habilitação em Harmonização",
                     "Resultado Discreto e Natural",
                     "Botox Para Homens Também",
                     "Frente à Ponte dos Bombeiros",
                     "Mais de 10 Anos em Brusque",
                     "Agende Pelo WhatsApp",
                     "Linhas de Expressão e Testa",
                     "Harmonização Orofacial Brusque",
                     "Plano Feito Para o Seu Rosto",
                     "Especitá Odontologia Brusque",
                 ], [
                     f"O que o botox faz e o que não faz, explicado na avaliação. {CRO}",
                     f"Dra. Catiucia, habilitação em harmonização orofacial (EPAO 4417). Clínica em Brusque.",
                     f"Avaliação facial individual com plano para o seu rosto. Agende pelo WhatsApp.",
                     f"Botox para linhas de expressão, para mulheres e homens, em Brusque, bairro Santa Rita.",
                 ], pins={1: 1}, dpins={1: 1})),
            dict(nome="Harmonização e preenchimento",
                 kws=[("harmonização facial brusque", "frase"), ("harmonização orofacial", "frase"), ("harmonização facial", "frase"),
                      ("preenchimento labial brusque", "frase"), ("preenchimento facial", "frase"), ("bioestimulador de colágeno", "frase"),
                      ("preenchimento com ácido hialurônico", "frase"), ("harmonização facial dentista", "frase")],
                 url=f"{BASE}/", path=("harmonizacao", "facial"),
                 ad=rsa([
                     "Harmonização Facial em Brusque",
                     "Harmonização Orofacial",
                     "Preenchimento e Bioestimulador",
                     "Avaliação Facial Individual",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Habilitação em Harmonização",
                     "Resultado Discreto e Natural",
                     "Plano Feito Para o Seu Rosto",
                     "Frente à Ponte dos Bombeiros",
                     "Mais de 10 Anos em Brusque",
                     "Agende Pelo WhatsApp",
                     "Preenchimento Labial Brusque",
                     "Etapas Explicadas Sem Pressa",
                     "Para Noivas e Para Homens",
                     "Especitá Odontologia Brusque",
                 ], [
                     f"Harmonização orofacial com avaliação individual, sem exagero. {CRO}",
                     f"Dra. Catiucia, habilitação em harmonização orofacial (EPAO 4417). Clínica em Brusque.",
                     f"Preenchimento, bioestimulador e botox explicados na avaliação. Agende pelo WhatsApp.",
                     f"Clínica em Brusque há mais de 10 anos, frente à ponte dos bombeiros. Resultado discreto.",
                 ], pins={1: 1}, dpins={1: 1})),
        ]),
    # ------------------------------------------------------------------ 7
    dict(
        nome="ESP - Dentista em Brusque e Família", local_upload="Brusque,State of Santa Catarina,Brazil;", orcamento=10.00, status="Ativada",
        local="Somente a cidade de Brusque (presença física), sem raio e sem cidades vizinhas", raio="pedido do Salvador em 05/10: a cidade é vertical, raio pega lugar longe",
        contato="Página 'Dentista em Brusque' / 'Família' + WhatsApp + ligação. Rede de segurança: sempre ligada.",
        programacao="Seg–sex 7h–21h, sáb 7h–13h.",
        publicos="Observação: Eventos da vida 'Mudança recente'; Demografia detalhada 'Pais (todos)'. Depois de 30 dias: remarketing de visitantes do site.",
        meta="≤ R$ 30 por conversa; ≥ 50% agendam avaliação; pacientes por família ≥ 2.",
        teste="T1: 'Novo em Brusque' x 'Um dentista para a família toda'. Palavra 'dentista brusque' entra só em frase e com lance baixo (histórico ruim: qualidade 3/10).",
        grupos=[
            dict(nome="Dentista em Brusque",
                 kws=[("dentista em brusque", "frase"), ("clínica odontológica brusque", "frase"), ("clinica odontologica brusque", "exata"),
                      ("dentista santa rita brusque", "frase"), ("dentista azambuja", "frase"), ("consulta dentista brusque", "frase"),
                      ("avaliação dentista brusque", "frase"), ("dentista brusque", "exata"), ("dentista bom em brusque", "frase")],
                 url=f"{BASE}/", path=("dentista", "brusque"),
                 ad=rsa([
                     "Dentista em Brusque",
                     "Clínica Odontológica Brusque",
                     "Avaliação Completa em Brusque",
                     "Novo em Brusque Sem Dentista?",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Frente à Ponte dos Bombeiros",
                     "Mais de 10 Anos em Brusque",
                     "Agende Pelo WhatsApp",
                     "Dentista no Bairro Santa Rita",
                     "Avaliação no Mesmo Dia",
                     "Implante, Ortodontia, Estética",
                     "Atendimento Seg a Sáb",
                     "Especitá Odontologia Brusque",
                     "Um Dentista Para a Família",
                     "1 Ano Sem Ir ao Dentista?",
                 ], [
                     f"Clínica odontológica em Brusque há mais de 10 anos. {CRO}",
                     f"Novo em Brusque e ainda sem dentista? Avaliação completa para começar do jeito certo.",
                     f"Implante, ortodontia, clareamento, odontopediatria e harmonização em um só lugar.",
                     f"Mais de um ano sem ir ao dentista? A avaliação mostra por onde começar, sem susto.",
                 ], pins={1: 1}, dpins={1: 1})),
            dict(nome="Família e convênio",
                 kws=[("dentista para família brusque", "frase"), ("limpeza dental brusque", "frase"), ("limpeza de dente dentista", "frase"),
                      ("dentista que atende convênio brusque", "frase"), ("dentista convênio brusque", "frase"), ("profilaxia dental brusque", "frase"),
                      ("check up dentista", "frase"), ("restauração dentária brusque", "frase")],
                 url=f"{BASE}/", path=("familia", "brusque"),
                 ad=rsa([
                     "Dentista Para a Família Toda",
                     "Limpeza e Avaliação em Brusque",
                     "Clínica Para Toda a Família",
                     "Família Avaliada no Mesmo Dia",
                     "Dra. Catiucia · CRO-SC 14067",
                     "Frente à Ponte dos Bombeiros",
                     "Mais de 10 Anos em Brusque",
                     "Agende Pelo WhatsApp",
                     "Limpeza, Restauração e Revisão",
                     "Crianças e Adultos Juntos",
                     "Revisão a Cada 6 Meses",
                     "Atendimento Seg a Sáb",
                     "Dentista no Bairro Santa Rita",
                     "Pergunte Sobre o Seu Convênio",
                     "Especitá Odontologia Brusque",
                 ], [
                     f"Uma clínica para a família inteira, em Brusque, Santa Rita. {CRO}",
                     f"Avaliação da família no mesmo dia, em frente à ponte dos bombeiros. Agende pelo WhatsApp.",
                     f"Pergunte pelo WhatsApp sobre o seu convênio e os horários de sábado.",
                     f"Limpeza, restauração e revisão a cada 6 meses, para crianças e adultos, perto de casa.",
                 ], pins={1: 1}, dpins={1: 1})),
        ]),
]

# ---------------------------------------------------------------------------
# Validação (limites do Google)
# ---------------------------------------------------------------------------
PROIBIDAS = ["grátis", "gratuit", "de graça", "promoção", "desconto", "parcel", "r$", "garant", "melhor", "o único",
             "depoimento", "antes e depois", "24 horas", "24h", "cura", "100%", "resultado garantido", "a partir de"]

def check():
    erros = []
    for c in CAMPANHAS:
        for g in c["grupos"]:
            ad = g["ad"]
            if len(ad["headlines"]) != 15:
                erros.append(f'{c["nome"]} / {g["nome"]}: {len(ad["headlines"])} títulos (precisa 15)')
            if len(ad["descriptions"]) != 4:
                erros.append(f'{c["nome"]} / {g["nome"]}: {len(ad["descriptions"])} descrições (precisa 4)')
            for i, h in enumerate(ad["headlines"], 1):
                if len(h) > 30:
                    erros.append(f'{c["nome"]} / {g["nome"]}: título {i} com {len(h)} chars: "{h}"')
            for i, d in enumerate(ad["descriptions"], 1):
                if len(d) > 90:
                    erros.append(f'{c["nome"]} / {g["nome"]}: descrição {i} com {len(d)} chars: "{d}"')
            for p in g["path"]:
                if len(p) > 15:
                    erros.append(f'{c["nome"]} / {g["nome"]}: caminho "{p}" > 15')
            textos = ad["headlines"] + ad["descriptions"]
            for t in textos:
                for p in PROIBIDAS:
                    if p in t.lower():
                        erros.append(f'{c["nome"]} / {g["nome"]}: termo vedado "{p}" em "{t}"')
            if len(set(h.lower() for h in ad["headlines"])) != 15:
                erros.append(f'{c["nome"]} / {g["nome"]}: títulos repetidos')
    for s in SITELINKS:
        if len(s[0]) > 25 or len(s[1]) > 35 or len(s[2]) > 35:
            erros.append(f"sitelink fora do limite: {s}")
    for c in CALLOUTS:
        if len(c) > 25:
            erros.append(f"frase de destaque > 25: {c}")
    return erros

# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------
def md():
    out = io.StringIO()
    w = out.write
    total = sum(c["orcamento"] for c in CAMPANHAS)
    ativo = sum(c["orcamento"] for c in CAMPANHAS if c["status"] == "Ativada")
    w("# 07 · Google Ads — estrutura nova, uma campanha por produto\n\n")
    w("Criada em paralelo à campanha atual `[pesquisa] 18/08 dentista` (R$ 65/dia), que **não muda**. "
      "Cada produto vira uma campanha com orçamento, palavras, anúncio, destino e meta próprios, para ser testado "
      "como um negócio separado. Textos validados contra as regras do CFO (sem preço, parcelamento, grátis, promoção, "
      "garantia, superlativo, depoimento) e os limites do Google (15 títulos ≤ 30, 4 descrições ≤ 90).\n\n")
    w("## Configuração comum a todas as campanhas\n\n")
    w("| Item | Valor |\n|---|---|\n")
    w("| Tipo | Pesquisa, só Rede de Pesquisa (parceiros de pesquisa e Display **desligados**) |\n")
    w("| Lance | Maximizar conversões, **sem** CPA desejado até ter 30 conversões em 30 dias; depois CPA desejado igual ao real |\n")
    w("| AI Max / palavras amplas | Desligado no início (volume baixo em Brusque; só depois de 30 conversões/mês) |\n")
    w("| Local | Só a cidade de Brusque, \"Presença: pessoas no local\" (não \"presença ou interesse\"). Sem raio e sem cidades vizinhas: a cidade é vertical e o raio pega lugar longe. Ampliar para Guabiruba só se, depois de 30 dias, Implante ou Harmonização estiverem limitadas por volume |\n")
    w("| Idioma | Português |\n")
    w("| Conversões | Primárias: clique no WhatsApp (site), ligação pelo anúncio (≥ 30 s), envio de formulário de lead. Secundária: rota no mapa |\n")
    w("| Recursos | Sitelinks, frases de destaque, snippet de serviços, chamada (horário da clínica), local (Perfil da Empresa), imagem (foto real da clínica), nome e logo |\n")
    w("| Rotação | Otimizar (padrão). 1 anúncio responsivo por grupo no início; o 2º entra como teste na semana 3 |\n")
    w("| Negativas | Lista compartilhada \"ESP · Negativas gerais\" (abaixo) em todas; Implante/Harmonização sem as negativas de cidade |\n")
    w(f"| Orçamento novo | R$ {ativo:.0f}/dia nas ativas (R$ {total:.0f}/dia com Harmonização ligada) + R$ 65/dia da campanha atual |\n\n")
    w("## Para quem vai o contato (decisão por serviço)\n\n")
    w("| Serviço | Destino do anúncio | Formulário do Google? | Ligação? | Por quê |\n|---|---|---|---|---|\n")
    rows = [
        ("Urgência", "Site + botão WhatsApp no anúncio", "Não (vedado)", "Sim (horário da clínica)", "Quem está com dor decide pelo primeiro que responde; o botão de WhatsApp abre a conversa direto do anúncio."),
        ("Implante / prótese", "Site + botão WhatsApp", "Não (vedado)", "Sim", "Ticket alto: a qualificação (quantos dentes faltam, usa prótese, bairro) acontece no WhatsApp."),
        ("Ortodontia", "Site + botão WhatsApp", "Não (vedado)", "Não", "Adulto decide rápido; pais perguntam no WhatsApp."),
        ("Odontopediatria", "Site + botão WhatsApp", "Não (vedado)", "Não", "Mãe pergunta antes de agendar; conversa converte mais."),
        ("Clareamento / lentes", "Site + botão WhatsApp", "Não (vedado)", "Não", "Pergunta de valor e prazo: só no WhatsApp (CFO)."),
        ("Harmonização", "Site + botão WhatsApp", "Não (vedado)", "Sim", "Na Meta o formulário foi o lead mais barato; no Google não existe essa opção para saúde."),
        ("Dentista em Brusque / família", "Site + botão WhatsApp", "Não (vedado)", "Sim", "Rede de segurança; ligação ajuda quem busca 'dentista perto de mim'."),
    ]
    for r in rows:
        w("| " + " | ".join(r) + " |\n")
    w("\nFormulário de lead do Google: só perguntas padrão (nome, telefone, 'qual serviço te interessa'). "
      "A política do Google proíbe perguntar sobre saúde no formulário; a qualificação clínica fica no WhatsApp.\n\n")
    w("## Públicos que o Google permite usar hoje (como Observação, sem restringir)\n\n")
    w("Na conta não existe nenhum segmento (auditoria de 03/10). O que dá para ligar já no primeiro dia, por campanha:\n\n")
    for c in CAMPANHAS:
        w(f"- **{c['nome']}**: {c['publicos']}\n")
    w("\nDepois de 30 dias: lista de pacientes (Correspondência de clientes, com consentimento) para **excluir** quem já é "
      "paciente e, mais tarde, remarketing de visitantes do site (precisa da tag no site publicado).\n\n")
    w("## Negativas gerais (lista compartilhada)\n\n")
    w(", ".join(f"`{n}`" for n in NEG_GERAIS) + "\n\n")
    w("Extra em Implante: " + ", ".join(f"`{n}`" for n in NEG_IMPLANTE_EXTRA) + " (quem busca preço de implante quase nunca agenda; o anúncio não pode falar de preço).\n\n")
    w("## Recursos compartilhados\n\n**Sitelinks**\n\n")
    for s in SITELINKS:
        w(f"- {s[0]} | {s[1]} | {s[2]} | {s[3]}\n")
    w("\n**Frases de destaque**: " + " · ".join(CALLOUTS) + "\n\n")
    w(f"**Snippet** {SNIPPET[0]}: " + ", ".join(SNIPPET[1]) + "\n\n")
    w(f"**Chamada**: {PHONE} (conversão: ligação ≥ 30 s). **Local**: Perfil da Empresa da clínica (precisa estar reivindicado pela clínica).\n\n")
    w("---\n\n")
    for i, c in enumerate(CAMPANHAS, 1):
        w(f"## {i}. {c['nome']}\n\n")
        w(f"| | |\n|---|---|\n| Orçamento | R$ {c['orcamento']:.2f}/dia |\n| Status ao criar | {c['status']} |\n")
        w(f"| Local | {c['local']} ({c['raio']}) |\n| Contato | {c['contato']} |\n| Programação | {c['programacao']} |\n")
        w(f"| Públicos (observação) | {c['publicos']} |\n| Meta | {c['meta']} |\n| Teste | {c['teste']} |\n\n")
        for g in c["grupos"]:
            w(f"### Grupo: {g['nome']}\n\n")
            w("**Palavras-chave**: " + ", ".join(f'{"\"" + k + "\"" if t == "frase" else "[" + k + "]"}' for k, t in g["kws"]) + "\n\n")
            w(f"**URL final**: {g['url']}  ·  caminho: /{g['path'][0]}/{g['path'][1]}\n\n")
            w("**Títulos** (15)\n\n")
            for n, h in enumerate(g["ad"]["headlines"], 1):
                pin = " (fixado na posição 1)" if g["ad"]["pins"].get(n) else ""
                w(f"{n}. {h} ({len(h)}){pin}\n")
            w("\n**Descrições** (4)\n\n")
            for n, d in enumerate(g["ad"]["descriptions"], 1):
                w(f"{n}. {d} ({len(d)})\n")
            w("\n")
    w("---\n\n## Como vamos testar (resumo)\n\n")
    w("1. Semanas 1–2: tudo roda com Maximizar conversões sem meta. Leitura diária só de erro (anúncio reprovado, conversão não registrando). Nenhuma mudança.\n")
    w("2. Semana 2: relatório de termos de pesquisa de cada campanha; negativar o lixo, adicionar os termos que converteram como palavra exata.\n")
    w("3. Semana 3: entra o 2º anúncio em cada grupo (variação descrita em 'Teste' de cada campanha) e o formulário de lead em Implante e Harmonização.\n")
    w("4. Dia 30: decisão por campanha pela planilha do `05`: custo por conversa, por avaliação agendada e por paciente que compareceu. "
      "Campanha que não chega a 15 conversões/mês é fundida com a vizinha (ex.: Odontopediatria entra em Família) para o lance aprender.\n")
    w("5. A campanha antiga `[pesquisa] 18/08 dentista` continua igual durante os 30 dias; as palavras dela que coincidirem com as novas "
      "(implantes dentarios, dentista infantil, dor no dente, dentista em brusque) disputam o mesmo leilão dentro da conta. "
      "O Google mostra só um anúncio por conta e escolhe o de melhor classificação; no dia 30 a perdedora de cada palavra é pausada.\n\n")
    w("## Medição que precisa existir antes de ligar\n\n")
    w("- Tag do Google (gtag) no site publicado, com evento de conversão no clique de qualquer botão de WhatsApp (todos têm `data-wa-text`).\n")
    w("- Conversão de chamada pelo anúncio (recurso de chamada com relatório de chamadas ligado, ≥ 30 s).\n")
    w("- Conversão de envio do formulário de lead (nativa).\n")
    w("- Rota (Perfil da Empresa) como secundária, para não inflar o número que o lance usa.\n")
    w("- Em cada URL final: `?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={adgroupid}` via modelo de acompanhamento da conta, "
      "para o painel do WhatsApp etiquetar a origem da conversa.\n")
    return out.getvalue()

# ---------------------------------------------------------------------------
# CSVs no formato dos modelos oficiais de upload em massa (Ferramentas > Ações em massa > Uploads)
# ---------------------------------------------------------------------------
CID = "113-943-9321"
TRACK = "{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={adgroupid}&utm_term={keyword}"

def _write(name, cols, rows):
    with open(os.path.join(HERE, "upload", name), "w", encoding="utf-8-sig", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=cols)
        wr.writeheader()
        for r in rows:
            wr.writerow({k: r.get(k, "") for k in cols})
    return len(rows)

def csv_files():
    os.makedirs(os.path.join(HERE, "upload"), exist_ok=True)
    n = {}
    cols = ["Action", "Campaign status", "Campaign", "Campaign type", "Networks", "Budget", "Budget type",
            "Bid strategy type", "Language", "Location", "EU political ads", "Tracking template", "Label"]
    rows = []
    for c in CAMPANHAS:
        rows.append({"Action": "Add", "Campaign status": "Paused", "Campaign": c["nome"], "Campaign type": "Search",
                     "Networks": "Google search", "Budget": f"{c['orcamento']:.2f}".replace(".", ","), "Budget type": "Daily",
                     "Bid strategy type": "Maximize Conversions", "Language": "pt;", "Location": c["local_upload"], "EU political ads": "No",
                     "Tracking template": TRACK, "Label": "ESP-2026-10"})
    n["01-campanhas.csv"] = _write("01-campanhas.csv", cols, rows)
    cols = ["Action", "Campaign", "Ad group", "Status", "Ad group type"]
    rows = [{"Action": "Add", "Campaign": c["nome"], "Ad group": g["nome"], "Status": "Enabled", "Ad group type": "Standard"}
            for c in CAMPANHAS for g in c["grupos"]]
    n["02-grupos.csv"] = _write("02-grupos.csv", cols, rows)
    cols = ["Action", "Keyword status", "Campaign", "Ad group", "Keyword", "Type"]
    rows = [{"Action": "Add", "Keyword status": "Enabled", "Campaign": c["nome"], "Ad group": g["nome"],
             "Keyword": k, "Type": "Phrase match" if t == "frase" else "Exact match"}
            for c in CAMPANHAS for g in c["grupos"] for k, t in g["kws"]]
    n["03-palavras.csv"] = _write("03-palavras.csv", cols, rows)
    cols = ["Action", "Ad status", "Campaign", "Ad group", "Ad type"] + [f"Headline {i}" for i in range(1, 16)] + \
           ["Description 1", "Description 2", "Description 3", "Description 4", "Headline 1 position", "Description 1 position",
            "Path 1", "Path 2", "Final URL"]
    rows = []
    for c in CAMPANHAS:
        for g in c["grupos"]:
            r = {"Action": "Add", "Ad status": "Enabled", "Campaign": c["nome"], "Ad group": g["nome"],
                 "Ad type": "Responsive search ad", "Path 1": g["path"][0], "Path 2": g["path"][1], "Final URL": g["url"],
                 "Headline 1 position": "1", "Description 1 position": "1"}
            for i, h in enumerate(g["ad"]["headlines"], 1):
                r[f"Headline {i}"] = h
            d = g["ad"]["descriptions"]
            r["Description 1"], r["Description 2"], r["Description 3"], r["Description 4"] = d
            rows.append(r)
    n["04-anuncios.csv"] = _write("04-anuncios.csv", cols, rows)
    cols = ["Action", "Keyword status", "Level", "Campaign", "Negative keyword", "Type"]
    rows = []
    for c in CAMPANHAS:
        negs = (NEG_SEM_CIDADES if c.get("sem_cidades") else NEG_GERAIS) + c.get("negativas_extra", [])
        for k in negs:
            rows.append({"Action": "Add", "Keyword status": "Enabled", "Level": "Campaign", "Campaign": c["nome"], "Negative keyword": k, "Type": "Phrase match"})
    n["05-negativas.csv"] = _write("05-negativas.csv", cols, rows)
    cols = ["Row Type", "Action", "Asset action", "Level", "Campaign", "Sitelink text", "Final URL", "Description", "Description 2"]
    rows = [{"Row Type": "Sitelink", "Action": "Add", "Asset action": "Create new", "Level": "Campaign", "Campaign": c["nome"],
             "Sitelink text": sl[0], "Final URL": sl[3], "Description": sl[1], "Description 2": sl[2]} for c in CAMPANHAS for sl in SITELINKS]
    n["07-sitelinks.csv"] = _write("07-sitelinks.csv", cols, rows)
    return n

def main():
    erros = check()
    if erros:
        print("ERROS:\n - " + "\n - ".join(erros))
        sys.exit(1)
    with open(os.path.join(HERE, "07-GOOGLE-ADS-ESTRUTURA.md"), "w", encoding="utf-8") as f:
        f.write(md())
    n = csv_files()
    n_g = sum(len(c["grupos"]) for c in CAMPANHAS)
    n_k = sum(len(g["kws"]) for c in CAMPANHAS for g in c["grupos"])
    print(f"OK: {len(CAMPANHAS)} campanhas, {n_g} grupos, {n_k} palavras; upload/: " + ", ".join(f"{k}={v}" for k, v in n.items()))

if __name__ == "__main__":
    main()
