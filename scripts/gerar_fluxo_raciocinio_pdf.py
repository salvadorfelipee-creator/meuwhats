# -*- coding: utf-8 -*-
from fpdf import FPDF

FONT_DIR = "C:/Windows/Fonts/"
OUT_PATH = "C:/Users/Salvador/Documents/meuwhatsapp/fluxo_linha_raciocinio.pdf"

STAGE_COLOR = {
    "FATOS": (235, 245, 255),
    "DIREITO": (235, 255, 238),
    "ESTRATEGIA": (255, 245, 230),
    "PEDIDOS": (250, 235, 245),
}
STAGE_BORDER = {
    "FATOS": (60, 120, 200),
    "DIREITO": (40, 150, 80),
    "ESTRATEGIA": (210, 140, 30),
    "PEDIDOS": (170, 60, 130),
}

class PDF(FPDF):
    def footer(self):
        self.set_y(-12)
        self.set_font("Arial", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Pagina {self.page_no()}", align="C")

pdf = PDF(format="A4")
pdf.add_font("Arial", "", FONT_DIR + "arial.ttf")
pdf.add_font("Arial", "B", FONT_DIR + "arialbd.ttf")
pdf.add_font("Arial", "I", FONT_DIR + "ariali.ttf")
pdf.set_auto_page_break(auto=True, margin=16)
pdf.set_margins(20, 16, 20)
pdf.add_page()

pdf.set_font("Arial", "B", 16)
pdf.set_text_color(10, 10, 10)
pdf.multi_cell(pdf.epw, 8, "Linha de Raciocinio da Peticao", align="C")
pdf.set_font("Arial", "", 10.5)
pdf.set_text_color(90, 90, 90)
pdf.multi_cell(pdf.epw, 5.5,
    "Salvador Felipe Fernands Farias x Facebook Servicos Online do Brasil Ltda. "
    "- fluxo dos topicos usados para construir a peca, do fato ao pedido.",
    align="C")
pdf.set_text_color(20, 20, 20)
pdf.ln(4)

def stage_label(text, stage):
    r, g, b = STAGE_BORDER[stage]
    pdf.set_x(pdf.l_margin)
    pdf.set_fill_color(r, g, b)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Arial", "B", 10)
    pdf.cell(pdf.epw, 7, text, align="C", fill=True)
    pdf.set_text_color(20, 20, 20)
    pdf.ln(9)

def box(num, title, detail, stage):
    r, g, b = STAGE_COLOR[stage]
    br, bg_, bb = STAGE_BORDER[stage]
    pdf.set_x(pdf.l_margin)
    start_y = pdf.get_y()

    # measure height needed first by writing to a dummy area is complex in fpdf2;
    # instead just draw fill rect approx and place text with some padding.
    pdf.set_fill_color(r, g, b)
    pdf.set_draw_color(br, bg_, bb)
    pdf.set_line_width(0.4)

    pdf.set_font("Arial", "B", 10.5)
    title_line = f"{num}.  {title}"
    pdf.set_xy(pdf.l_margin + 3, start_y + 2)

    # Render text first in a throwaway pass is not simple; use multi_cell directly on
    # a cell border using 'B' box via rect drawn after computing line count manually.
    pdf.set_xy(pdf.l_margin, start_y)
    pdf.set_font("Arial", "", 9.7)
    # Estimate number of lines for detail
    avail_w = pdf.epw - 10
    pdf.set_font("Arial", "", 9.7)

    # First pass: write into memory to get final Y using multi_cell with border=0,
    # by temporarily writing off-page is not supported; simplest: just draw content,
    # then draw rect using recorded before/after Y, accepting box drawn AFTER text
    # would overlap. Instead: draw box using estimated height via char count heuristic.
    import math
    chars_per_line = int(avail_w / 1.9)
    n_lines_detail = max(1, math.ceil(len(detail) / chars_per_line))
    box_h = 8 + n_lines_detail * 5.0 + 4

    pdf.rect(pdf.l_margin, start_y, pdf.epw, box_h, style="F")
    pdf.rect(pdf.l_margin, start_y, pdf.epw, box_h, style="D")

    pdf.set_xy(pdf.l_margin + 4, start_y + 2)
    pdf.set_font("Arial", "B", 10.5)
    pdf.set_text_color(br, bg_, bb)
    pdf.multi_cell(pdf.epw - 8, 5.5, title_line)

    pdf.set_x(pdf.l_margin + 4)
    pdf.set_font("Arial", "", 9.7)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(pdf.epw - 8, 5.0, detail)

    pdf.set_y(start_y + box_h)
    pdf.set_text_color(20, 20, 20)

def arrow():
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "B", 12)
    pdf.set_text_color(140, 140, 140)
    pdf.cell(pdf.epw, 6, "|", align="C")
    pdf.ln(6)
    pdf.set_text_color(20, 20, 20)

# ---------------- FLUXO ----------------

stage_label("1. FATOS", "FATOS")
box(1, "Uso licito e de longa data",
    "Linha usada desde 2017 (abertura da empresa Handmoney), com mais de 180 mil "
    "mensagens/ano e zero denuncias ou avisos em 5+ anos de uso.", "FATOS")
arrow()
box(2, "A propria Meta aprovou uma campanha paga 3 dias antes do bloqueio",
    "Anuncio no Instagram (25/09/2026) direcionado ao mesmo numero foi processado e "
    "entregue pela Requerida sem qualquer rejeicao - contradiz a ideia de que a linha "
    "estava em desconformidade.", "FATOS")
arrow()
box(3, "Bloqueio sem aviso, sem gradacao, sem motivacao",
    "Em 28/09/2026 a conta foi banida de forma direta e definitiva, sem qualquer "
    "aviso previo, rebaixamento de qualificacao ou explicacao individualizada.", "FATOS")

pdf.ln(2)
stage_label("2. DIREITO", "DIREITO")
box(4, "Relacao de consumo (CDC)",
    "Responsabilidade objetiva da Requerida (art. 14, CDC); onus de provar excludente "
    "e da propria Requerida, que nao apresentou nenhuma.", "DIREITO")
arrow()
box(5, "Legitimidade passiva do Facebook Brasil",
    "Tese que NUNCA falhou nos precedentes de SC pesquisados - grupo economico Meta, "
    "STJ RMS 61.717/RJ e HDE 410/EX, Marco Civil art. 11.", "DIREITO")
arrow()
box(6, "Ilicitude do bloqueio",
    "Viola a propria politica de enforcement gradual da Meta (aviso -> restricoes "
    "crescentes -> bloqueio). Alem disso, o produto do cliente (consignado) nao esta "
    "na lista de categorias que a Meta proibe (payday loan, adiantamento salarial).", "DIREITO")

pdf.add_page()
stage_label("3. ESTRATEGIA PROCESSUAL", "ESTRATEGIA")
box(7, "Escolha do Juizado Especial Civel (Comarca de Camboriu)",
    "Achado de pesquisa: em processo real (Facebook x Bruna Pereira Gomes de Souza), a "
    "Turma Recursal NEM CONHECEU o agravo de instrumento do Facebook contra uma tutela "
    "concedida - no Juizado, tutela e praticamente irrecorrivel de imediato.", "ESTRATEGIA")
arrow()
box(8, "Cuidado com a forma da procuracao",
    "Em processo similar (Marilia/SP), o andamento foi suspenso por a procuracao ter "
    "sido assinada via ZapSign, plataforma nao credenciada pela ICP-Brasil. Recomenda-se "
    "assinatura com certificado ICP-Brasil ou reconhecimento em cartorio.", "ESTRATEGIA")

pdf.ln(2)
stage_label("4. PEDIDOS", "PEDIDOS")
box(9, "Tutela de urgencia",
    "Reativacao em 48h, multa diaria de R$ 500,00 (limite R$ 15.000,00 nesta fase).", "PEDIDOS")
arrow()
box(10, "Dano moral - R$ 8.000,00",
    "Acima da media de SC (R$ 2.000 a R$ 7.000) por conta dos agravantes especificos: "
    "zero aviso, campanha paga aprovada dias antes, uso desde 2017.", "PEDIDOS")
arrow()
box(11, "Dano material (lucros cessantes)",
    "R$ 150,00/dia (equivalente a R$ 4.500,00/mes de comissoes), desde 28/09/2026 "
    "at\u00e9 a data da efetiva reativacao da conta.", "PEDIDOS")

pdf.output(OUT_PATH)
print("PDF gerado em:", OUT_PATH)
