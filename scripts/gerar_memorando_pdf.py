# -*- coding: utf-8 -*-
from fpdf import FPDF

FONT_DIR = "C:/Windows/Fonts/"
OUT_PATH = "C:/Users/Salvador/Documents/meuwhatsapp/memorando_pesquisa_precedentes_facebook.pdf"

class PDF(FPDF):
    def header(self):
        pass
    def footer(self):
        self.set_y(-12)
        self.set_font("Arial", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Pagina {self.page_no()}", align="C")

pdf = PDF(format="A4")
pdf.add_font("Arial", "", FONT_DIR + "arial.ttf")
pdf.add_font("Arial", "B", FONT_DIR + "arialbd.ttf")
pdf.add_font("Arial", "I", FONT_DIR + "ariali.ttf")
pdf.set_auto_page_break(auto=True, margin=18)
pdf.set_margins(20, 18, 20)
pdf.add_page()
pdf.set_text_color(20, 20, 20)

def h1(text):
    pdf.ln(3)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "B", 15)
    pdf.set_text_color(10, 10, 10)
    pdf.multi_cell(pdf.epw, 8, text)
    pdf.set_text_color(20, 20, 20)
    pdf.ln(1)

def h2(text):
    pdf.ln(2)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "B", 12)
    pdf.multi_cell(pdf.epw, 7, text)
    pdf.ln(1)

def h3(text):
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "B", 10.5)
    pdf.multi_cell(pdf.epw, 6, text)

def p(text, size=10.5):
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "", size)
    pdf.multi_cell(pdf.epw, 5.6, text)
    pdf.ln(1)

def bullet(text, size=10.5):
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "", size)
    pdf.multi_cell(pdf.epw - 4, 5.6, "-  " + text)
    pdf.ln(0.5)

def case_row(processo, autor, resultado, detalhe):
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "B", 10)
    pdf.multi_cell(pdf.epw, 5.6, f"{processo} - {autor}")
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Arial", "", 10)
    if "GANHOU" in resultado.upper() or "PROCEDENTE" in resultado.upper():
        pdf.set_text_color(0, 90, 0)
    else:
        pdf.set_text_color(150, 0, 0)
    pdf.multi_cell(pdf.epw, 5.6, f"Resultado: {resultado}")
    pdf.set_text_color(20, 20, 20)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(pdf.epw, 5.6, detalhe)
    pdf.ln(2)

def hr():
    pdf.ln(1)
    pdf.set_draw_color(180, 180, 180)
    y = pdf.get_y()
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.ln(3)

# ---------------- CONTEUDO ----------------

h1("Memorando de Pesquisa Jurisprudencial")
p("Ref.: Acao de Obrigacao de Fazer c/c Indenizacao por Danos Morais e Materiais - "
  "Salvador Felipe Fernands Farias x Facebook Servicos Online do Brasil Ltda. "
  "(bloqueio de conta de WhatsApp Business vinculada ao numero +55 47 99705-9353)")
p("Preparado para: Dr. Fagner Fernands Farias (OAB/SC 35.932)")
p("Objetivo: reunir, em um so documento, o levantamento de jurisprudencia de Santa Catarina "
  "(e alguns precedentes de Sao Paulo) sobre acoes contra o Facebook por bloqueio de contas de "
  "WhatsApp/Instagram, separando o que resultou em vitoria e o que resultou em derrota, "
  "para cruzamento com a peca que ja foi redigida.")

hr()

h2("1. Metodologia")
p("A pesquisa foi feita por meio de consulta publica no eProc do TJSC (busca por OAB, com "
  "'Exibir Baixados' habilitado) e no e-SAJ do TJSP (consulta publica por OAB), sem uso de "
  "qualquer acesso privilegiado ou habilitacao em processo de terceiro - apenas dados de "
  "movimentacao processual e sentencas que sao publicos.")
p("Foram consultados os processos de duas advogadas que atuam nesse tipo de causa (Cibele "
  "Viudes Ribas, OAB/SP 335.443, e Fernando Ramos de Favere, OAB/SC 24.845), bem como os "
  "processos em que figura como advogado do Facebook em Santa Catarina o Dr. Paulo Antonio "
  "Muller (OAB/SC 30.741) - que aparece como patrono da re em mais de mil processos no estado, "
  "o que confirma ser ele o advogado padrao do Facebook em SC.")

hr()

h2("2. Padrao de defesa do Facebook (repete em praticamente todos os casos)")
p("Em todos os processos com sentenca de merito localizados, a defesa arguiu preliminar de "
  "ilegitimidade passiva, sob o argumento de que o WhatsApp pertence a WhatsApp LLC, empresa "
  "americana distinta do Facebook Servicos Online do Brasil Ltda. Essa preliminar foi REJEITADA "
  "em 100% dos casos com sentenca de merito. Os fundamentos mais usados pelos juizes para "
  "rejeitar essa tese, e que ja constam na peca elaborada, foram:")
bullet("STJ, RMS n. 61.717/RJ (Rel. Min. Laurita Vaz, j. 02/03/2021) - Facebook Brasil e parte "
       "legitima para representar o WhatsApp Inc. no Brasil;")
bullet("STJ, HDE 410/EX (Rel. Min. Benedito Goncalves, Corte Especial, j. 20/11/2019);")
bullet("Marco Civil da Internet, art. 11, par. 1 a 4, e art. 75, X e par. 3, do CPC;")
bullet("CDC, art. 28, par. 2 (desconsideracao da personalidade juridica em grupo economico).")

hr()

h2("3. Casos em que o autor GANHOU (procedente ou parcialmente procedente)")

case_row(
    "5000584-84.2026.8.24.0144 (Vara Unica de Rio do Oeste/SC)",
    "Vinicius da Rocha, Lucas Gabriel Weber e Thiago Luiz Dela Justina",
    "PROCEDENTE",
    "Perfis falsos usando o numero dos autores no WhatsApp. Sentenca determinou exclusao do "
    "numero fraudulento + R$ 3.000,00 de dano moral PARA CADA autor. Ponto-chave: o Facebook "
    "descumpriu a propria tutela concedida antes da sentenca, e o juiz MAJOROU a multa diaria "
    "de valor original para R$ 1.000,00/dia (limite R$ 20.000,00), citando STJ AREsp 2.537.035 "
    "sobre majoracao de multa insuficiente. A sentenca cita ainda um precedente quase identico "
    "ao nosso caso: TJSC, AI n. 5054032-50.2025.8.24.0000 (1a Camara de Direito Civil, Rel. p/ "
    "Acordao Flavio Andre Paz de Brum, j. 30/10/2025) - reativacao de WhatsApp Business de "
    "empresa de eventos, astreintes de R$ 200,00/dia (limite R$ 5.000,00)."
)

case_row(
    "5000478-42.2026.8.24.0009 (Vara Unica de Bom Retiro/SC)",
    "Marineuma Michels (advogada)",
    "PROCEDENTE",
    "Perfil falso cobrando clientes em nome da autora. R$ 2.000,00 de dano moral + multa de "
    "R$ 150,00/dia (limite R$ 5.000,00) para remocao definitiva do perfil."
)

case_row(
    "5001247-69.2026.8.24.0035 (1a Vara de Itapoa/SC)",
    "Bruna Schug",
    "PROCEDENTE",
    "R$ 5.000,00 de dano moral. Multa majorada para R$ 500,00/dia (limite de 30 infracoes) "
    "por descumprimento comprovado da tutela originalmente concedida."
)

case_row(
    "5008466-62.2026.8.24.0091 (1o Juizado Especial Civel de Florianopolis/SC)",
    "Fernando Ramos de Favere (advogado, em causa propria)",
    "PARCIALMENTE PROCEDENTE",
    "14 perfis falsos usando a identidade profissional do proprio advogado autor. Ganhou o "
    "bloqueio definitivo dos perfis + R$ 7.000,00 de dano moral. PERDEU o pedido de bloqueio "
    "generico/permanente de qualquer perfil futuro com seus dados - juiz considerou "
    "desproporcional e inviavel tecnicamente."
)

case_row(
    "1081906-49.2024.8.26.0100 (2a Vara Civel do Foro Central Civel de Sao Paulo/SP)",
    "Lauriane Evangelista (cliente da Dra. Cibele Viudes Ribas)",
    "PROCEDENTE",
    "Reativacao de conta do Facebook + R$ 4.000,00 de dano moral + 15% de honorarios. "
    "Passou por acordao no TJSP e chegou a fase de cumprimento de sentenca (ou seja, "
    "decisao definitiva e favoravel confirmada em 2a instancia)."
)

case_row(
    "1076989-84.2024.8.26.0100 (7a Vara Civel do Foro Central Civel de Sao Paulo/SP)",
    "Nathalin Lohany Carvalho de Oliveira",
    "PROCEDENTE",
    "Reativacao de perfil (Instagram/Facebook) + R$ 3.000,00 de dano moral + 20% de "
    "honorarios. A propria autora recorreu pedindo majoracao do valor; o Facebook nao "
    "recorreu (aceitou a derrota no merito)."
)

case_row(
    "1060141-22.2024.8.26.0100 (6a Vara Civel do Foro Central Civel de Sao Paulo/SP)",
    "Magda Ferreira Gomes da Silva",
    "PROCEDENTE",
    "Condenacao confirmada e transitada em julgado; custas efetivamente pagas pelo Facebook "
    "e processo arquivado definitivamente."
)

hr()

h2("4. Caso em que o autor PERDEU (improcedente) - e por que")

case_row(
    "5001042-07.2026.8.24.0143 (Vara Unica de Meleiro/SC)",
    "Debora Nilza Machado (advogada)",
    "IMPROCEDENTE (Facebook venceu)",
    "Golpe do 'falso advogado' - terceiros usando o nome da autora em contas de WhatsApp "
    "para aplicar fraudes contra clientes dela. O juiz REJEITOU a preliminar de "
    "ilegitimidade passiva (mesmo raciocinio dos casos acima), mas julgou IMPROCEDENTE o "
    "merito porque a autora nao comprovou ter feito uma DENUNCIA ESPECIFICA e "
    "INDIVIDUALIZADA de um numero determinado dentro dos canais oficiais do WhatsApp, "
    "seguida de inercia comprovada da plataforma. So um boletim de ocorrencia generico nao "
    "bastou. O juiz aplicou a excludente do art. 14, par. 3, II, do CDC (fato exclusivo de "
    "terceiro / fortuito externo), afirmando que o Facebook nao pode ser responsabilizado "
    "pelo simples fato de o crime ter ocorrido atraves da plataforma - so responde pela "
    "omissao apos ter sido comprovadamente avisado."
)

p("CONCLUSAO PRATICA DESSE CASO: a diferenca entre ganhar e perder, nesses processos contra "
  "o Facebook, nao esta na tese juridica (que e sempre a mesma e sempre favoravel ao autor "
  "quanto a legitimidade passiva) - esta na PROVA DOCUMENTAL. Isso reforca a importancia dos "
  "documentos que ja anexamos na peca (prints do bloqueio, do pedido de analise negado, do "
  "historico de atividades da conta e da campanha paga), porque no nosso caso o problema nao "
  "e fraude de terceiro, e sim o bloqueio direto da propria conta do requerente - mas o "
  "principio e o mesmo: quanto mais documentado, melhor.", size=10.5)

hr()

h2("5. Achado processual relevante: o Facebook nao consegue recorrer de tutela em Juizado Especial")

case_row(
    "5001411-28.2026.8.24.0910 (2a Turma Recursal de SC)",
    "Facebook Servicos Online do Brasil Ltda. (recorrente) x Bruna Pereira Gomes de Souza",
    "Facebook PERDEU o recurso (nao conhecido)",
    "O Facebook tentou agravo de instrumento contra a tutela de urgencia concedida contra ele. "
    "A Turma Recursal NEM CONHECEU o recurso, porque no rito dos Juizados Especiais Civeis a "
    "decisao interlocutoria que concede tutela de urgencia e IRRECORRIVEL de imediato (art. 3 "
    "e 4 da Lei 12.153/09, Enunciado 15 do FONAJE, art. 932, III, do CPC). Isso confirma que a "
    "escolha do Juizado Especial Civel (em vez de Vara Civel comum) e estrategicamente boa: "
    "uma vez concedida a tutela, o Facebook tem dificuldade real de reverte-la rapidamente."
)

hr()

h2("6. Caso mais parecido com o nosso, ainda em andamento (atencao a um risco processual)")

case_row(
    "5003111-11.2026.8.24.0014 (5a Vara Civel de Marilia/SP - fora de SC, mas caso muito "
    "similar de WhatsApp Business)",
    "Rodrigo Caparroz Maciel (autor pessoa fisica, vendedor autonomo)",
    "Tutela CONCEDIDA, merito ainda pendente",
    "Reativacao determinada em 48h, multa de R$ 1.000,00/dia (limite R$ 10.000,00). PONTO DE "
    "ATENCAO: o juiz suspendeu o andamento do processo porque a procuracao do autor foi "
    "assinada digitalmente pela plataforma ZapSign, que NAO e credenciada pela ICP-Brasil - "
    "haveria descumprimento do art. 1, par. 2, III, 'a', da Lei 11.419/2006. Recomendacao: "
    "garantir que a procuracao do nosso cliente seja assinada com certificado ICP-Brasil ou "
    "reconhecida em cartorio, para evitar o mesmo problema."
)

hr()

h2("7. Numeros de todos os processos citados, para consulta direta")
p("Todos consultaveis publicamente em https://eproc1g.tjsc.jus.br (Consulta Processual) ou "
  "https://esaj.tjsp.jus.br/cpopg (para os processos de SP).")
for num in [
    "5000584-84.2026.8.24.0144",
    "5000478-42.2026.8.24.0009",
    "5001247-69.2026.8.24.0035",
    "5008466-62.2026.8.24.0091",
    "5001042-07.2026.8.24.0143",
    "5001411-28.2026.8.24.0910",
    "5003111-11.2026.8.24.0014 (TJSP - Marilia)",
    "1081906-49.2024.8.26.0100 (TJSP)",
    "1076989-84.2024.8.26.0100 (TJSP)",
    "1060141-22.2024.8.26.0100 (TJSP)",
]:
    bullet(num, size=10)

hr()

h2("8. Advogados identificados (para eventual referencia)")
bullet("Cibele Viudes Ribas - OAB/SP 335.443 (autora dos casos de SP e do caso de Marilia).")
bullet("Fernando Ramos de Favere - OAB/SC 24.845 (Florianopolis, especializado em bloqueio de "
       "WhatsApp/Instagram - site favereadvogados.com.br).")
bullet("Paulo Antonio Muller - OAB/SC 30.741 (advogado padrao do Facebook em SC).")
bullet("Celso de Faria Monteiro - OAB/SP 138.436 (advogado do Facebook em SP).")

hr()

h2("9. Como isso foi aplicado na peca ja redigida")
bullet("Fundamentacao de legitimidade passiva com os mesmos precedentes STJ que nunca falharam.")
bullet("Secao especifica sobre ausencia de gradacao no bloqueio, citando a propria politica de "
       "enforcement da Meta (aviso -> restricoes crescentes -> bloqueio), que nao foi seguida.")
bullet("Distincao entre o produto do cliente (emprestimo consignado) e as categorias que a "
       "Meta efetivamente proibe (payday loans, adiantamento salarial), para afastar qualquer "
       "alegacao de violacao das diretrizes comerciais.")
bullet("Opcao pelo Juizado Especial Civel da Comarca de Camboriu, com base no achado do item 5 "
       "deste memorando (tutela dificilmente reversivel por recurso do Facebook).")
bullet("Valor de dano moral fixado em R$ 8.000,00, acima da media de SC (R$ 2.000 a R$ 7.000), "
       "por conta dos fatores agravantes especificos do caso (zero aviso, campanha paga "
       "aprovada 3 dias antes do bloqueio, uso desde 2017).")
bullet("Atencao recomendada: verificar a forma de assinatura da procuracao (item 6 deste "
       "memorando) para evitar o mesmo problema enfrentado no caso de Marilia.")

pdf.output(OUT_PATH)
print("PDF gerado em:", OUT_PATH)
