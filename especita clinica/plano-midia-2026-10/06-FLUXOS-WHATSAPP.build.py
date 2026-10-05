# -*- coding: utf-8 -*-
"""Gera a página 'Fluxos de WhatsApp Especitá' (telefones simulados + notas amarelas)."""
import io, os, html

OUT = r"C:\Users\Salvador\Documents\meuwhatsapp\especita clinica\plano-midia-2026-10\06-FLUXOS-WHATSAPP.html"

# ---------- tipos de balão ----------
# ("c", texto)                 cliente (esquerda, branco)
# ("b", texto, [botões])       robô/automático (direita, verde) com botões opcionais
# ("h", texto)                 humano / recepção (direita, verde escuro)
# ("t", texto)                 template fora da janela de 24h (direita, azul)
# ("n", texto)                 nota amarela (sugestão de implementação / script humano)
# ("s", texto)                 sistema (cinza central: tag, etapa, timer)

def e(s): return html.escape(s).replace("\n", "<br>")

def bubble(item):
    k = item[0]
    if k == "c":
        return f'<div class="m c"><div class="who">Paciente</div>{e(item[1])}</div>'
    if k == "b":
        btns = "".join(f'<span class="btn">{e(b)}</span>' for b in (item[2] if len(item) > 2 else []))
        return f'<div class="m b"><div class="who">🤖 Automático (SDR)</div>{e(item[1])}{("<div class=btns>" + btns + "</div>") if btns else ""}</div>'
    if k == "h":
        return f'<div class="m h"><div class="who">👩 Recepção (humano)</div>{e(item[1])}</div>'
    if k == "t":
        return f'<div class="m t"><div class="who">📨 Template (fora da janela de 24h)</div>{e(item[1])}</div>'
    if k == "n":
        return f'<div class="note">💡 {e(item[1])}</div>'
    if k == "s":
        return f'<div class="sys">⚙ {e(item[1])}</div>'
    raise ValueError(k)

def phone(title, items):
    body = "\n".join(bubble(i) for i in items)
    return f'''<div class="phone"><div class="ph-top"><span class="av">E</span><div><b>Especitá Odontologia</b><small>Conta comercial · online</small></div></div><div class="ph-body">{body}</div><div class="ph-foot">Mensagem</div></div>'''

def rules(rows):
    return "".join(f'<div class="rule"><span>{e(k)}</span><div>{v}</div></div>' for k, v in rows)

FLOWS = []
def flow(id, num, title, lede, items, rows, mode):
    FLOWS.append(dict(id=id, num=num, title=title, lede=lede, items=items, rows=rows, mode=mode))

# =====================================================================
flow("entrada", "0", "Porta de entrada", "Toda conversa começa aqui. Quem vem de anúncio pula o menu e cai direto no fluxo do produto; quem manda mensagem solta escolhe no menu.",
[
 ("c", "Oi, boa tarde"),
 ("b", "Oi! 😊 Aqui é a Especitá Odontologia e Estética, em Brusque. Me conta o que você precisa que eu já te encaminho:", ["🦷 Dor de dente ou dente quebrado", "🔩 Implante ou prótese", "😁 Aparelho ou alinhador"]),
 ("b", "Ou escolha na lista completa 👇", ["👧 Dentista para criança", "✨ Clareamento ou lente", "💉 Harmonização facial", "🩺 Avaliação / check-up", "📅 Já sou paciente"]),
 ("n", "Implementação: o motor de fluxo do painel envia botões (até 3) ou lista (até 10 opções). Além do clique, aceitar texto livre com palavras-chave: 'dor', 'quebrou', 'implante', 'aparelho', 'criança', 'filho', 'clarear', 'botox', 'avaliação', 'remarcar'."),
 ("c", "Vim pelo anúncio de implante e quero saber mais"),
 ("s", "Mensagem pré-preenchida do anúncio → gatilho por palavra-chave 'anúncio de implante' → pula o menu, abre o fluxo 3, grava Origem = Anúncio Meta Implante, etiqueta Implante"),
 ("n", "Cada anúncio e cada link da bio usa um texto pré-preenchido diferente ('Vim pelo anúncio de X'). É assim que a origem do paciente entra sozinha no CRM, sem perguntar."),
 ("b", "Perfeito! Antes de tudo, pode me dizer seu nome? 😊"),
 ("c", "Valdir"),
 ("s", "Nome salvo no contato → segue para o fluxo do produto"),
 ("n", "Regra de ouro: no máximo 3 perguntas automáticas antes de entregar para a recepção. Mais que isso, a pessoa abandona (benchmark do setor)."),
],
[("Gatilho", "Primeira mensagem do número, ou palavra-chave, ou clique em anúncio com texto pré-preenchido"),
 ("Dados que viram CRM", "Nome · Origem (anúncio / orgânico / Instagram / indicação) · Produto de interesse"),
 ("Etapa do pipeline", "Novo contato"),
 ("Fora do horário", "Ver bloco comum 'Fora do horário' no fim da página"),
 ("Motor do painel", "fluxos_dinamicos: gatilho 'primeiro contato' + gatilhos por palavra-chave; nó mensagem com botões; nó ação (tag + etapa)")],
"Automático")

# =====================================================================
flow("quebrado", "1", "Dente quebrado (urgência)", "Maior intenção de todas. O robô acalma, coleta foto e nome; a recepção entra em até 10 minutos com o encaixe do dia.",
[
 ("c", "Quebrei um dente da frente agora no almoço 😢"),
 ("b", "Poxa, sinto muito! Fica tranquilo(a), dá pra resolver. 🙏 Está doendo agora?", ["Muito", "Um pouco", "Não dói"]),
 ("c", "Um pouco"),
 ("b", "Entendi. Consegue me mandar uma foto do dente? Ajuda a Dra. a já saber o que fazer."),
 ("c", "📷 (foto)"),
 ("b", "Recebi! Qual seu nome? Vou chamar a recepção agora pra te passar o horário de encaixe de hoje."),
 ("c", "Ricardo"),
 ("s", "Etiqueta URGÊNCIA (vermelha) · Etapa: Novo contato · Alerta sonoro na recepção · SLA 10 min"),
 ("b", "Obrigado, Ricardo. Enquanto isso: se tiver o pedaço do dente, guarda num potinho com leite ou soro e evita mastigar desse lado. Já te respondo com o horário! ⏱"),
 ("n", "Orientação de primeiros socorros é texto fixo aprovado pela Dra., sem diagnóstico nem remédio. O robô nunca indica medicação."),
 ("h", "Ricardo, aqui é a Aline, da Especitá. A Dra. Catiucia tem encaixe hoje às 15h40 ou 17h20. Qual fica melhor pra você? A clínica fica na Rua Sete de Setembro, 55, em frente à ponte dos bombeiros."),
 ("n", "Script humano: dois horários concretos, nunca 'qual o melhor dia'. Se o paciente perguntar valor: 'a avaliação de urgência é R$ __ e a Dra. te explica o que precisa antes de fazer qualquer coisa'. Valor pode ser dito aqui (conversa privada), nunca no anúncio."),
 ("c", "15h40"),
 ("h", "Fechado! 15h40 hoje com a Dra. Catiucia. 📍 Localização: (pin do mapa). Se piorar a dor antes, me avisa por aqui."),
 ("s", "Etapa: Avaliação agendada · Consulta criada 15h40 · Lembrete 1h antes (template utilitário)"),
 ("n", "Agendamento aqui é sempre humano: urgência precisa de encaixe real na agenda. A clínica reserva 1 encaixe por turno para isso."),
],
[("Gatilho", "Menu 'Dor de dente ou dente quebrado' · palavras 'quebrou', 'quebrei', 'caiu', 'lascou' · anúncio Urgência"),
 ("Perguntas do robô (3)", "Dói? · Foto · Nome"),
 ("Humano entra", "Imediatamente após o nome, com SLA de 10 min em horário comercial"),
 ("Agendamento", "Humano (encaixe do dia). Não automatizar."),
 ("Etiqueta / etapa", "URGÊNCIA + Dente quebrado · Novo contato → Avaliação agendada"),
 ("Fora do horário", "Template: 'Primeiro horário amanhã às 8h. Se a dor ficar forte, responda URGENTE' (a Dra. decide se recebe alerta)")],
"Robô qualifica → humano agenda")

# =====================================================================
flow("dor", "2", "Dor de dente (urgência)", "Mesma lógica do dente quebrado, com triagem de gravidade: inchaço ou febre viram prioridade máxima.",
[
 ("c", "Estou com uma dor de dente muito forte desde ontem"),
 ("b", "Sinto muito! Vamos cuidar disso hoje. Me ajuda com duas perguntas rápidas: tem inchaço no rosto ou febre?", ["Sim", "Não"]),
 ("c", "Tem um inchaço"),
 ("s", "Resposta 'Sim' → etiqueta URGÊNCIA MÁXIMA · alerta imediato para a recepção e para a Dra."),
 ("b", "Entendi. Inchaço merece atenção rápida. Qual seu nome? Já estou chamando a recepção pra te encaixar hoje."),
 ("c", "Marlene"),
 ("b", "Obrigado, Marlene. A recepção te responde em até 10 minutos. Enquanto isso, evita alimentos muito quentes ou doces nesse lado. 🙏"),
 ("n", "Se a resposta fosse 'Não': robô pergunta 'há quanto tempo dói?' (botões: hoje / alguns dias / mais de 1 semana) e segue para a recepção do mesmo jeito. Nunca mais de 3 perguntas."),
 ("h", "Marlene, aqui é a Aline, da Especitá. A Dra. Catiucia consegue te ver hoje às 11h10 ou às 16h. Qual você prefere?"),
 ("c", "11h10"),
 ("h", "Combinado: hoje, 11h10. 📍 Rua Sete de Setembro, 55, em frente à ponte dos bombeiros. Chegando, é só dizer seu nome na recepção."),
 ("s", "Etapa: Avaliação agendada · Lembrete 1h antes"),
 ("n", "Medo de dentista é o principal motivo de a pessoa adiar. Script humano acolhedor: 'primeiro a gente tira a dor, depois conversa sobre o resto, com calma'."),
 ("n", "Depois da consulta (24h): template de satisfação 0 a 10. Nota 9 ou 10 → link de avaliação no Google. Nota baixa → a Dra. liga."),
],
[("Gatilho", "Menu urgência · palavras 'dor', 'doendo', 'dói', 'inflamou', 'inchado'"),
 ("Perguntas do robô (2 a 3)", "Inchaço/febre? · (se não) há quanto tempo? · Nome"),
 ("Humano entra", "Logo após o nome; prioridade máxima se inchaço ou febre"),
 ("Agendamento", "Humano, encaixe do dia"),
 ("Etiqueta / etapa", "URGÊNCIA + Dor · Novo contato → Avaliação agendada"),
 ("Pós-consulta", "Satisfação 24h depois → Google")],
"Robô qualifica → humano agenda")

# =====================================================================
flow("implante", "3", "Implante e prótese protocolo", "Ticket mais alto da clínica. O robô qualifica o caso em 3 perguntas e o humano fecha a avaliação. Preço só na conversa, nunca no anúncio.",
[
 ("c", "Vim pelo anúncio de implante e quero saber mais"),
 ("s", "Origem = Anúncio Meta Implante · Etiqueta Implante · Nome já coletado na entrada"),
 ("b", "Que bom, Valdir! A Dra. Catiucia faz implante e prótese protocolo aqui em Brusque há mais de 10 anos. Pra eu te orientar certo: quantos dentes faltam?", ["Só 1", "Vários", "Todos (uso prótese)"]),
 ("c", "Todos, uso dentadura"),
 ("b", "Entendi. E a sua prótese hoje: ela solta ou machuca ao comer?", ["Sim, incomoda", "Não, só quero trocar"]),
 ("c", "Solta e machuca"),
 ("b", "Você mora em Brusque ou em outra cidade?"),
 ("c", "Guabiruba"),
 ("s", "Campos: Interesse = Prótese protocolo · Usa prótese = Sim · Cidade = Guabiruba · Etapa: Em qualificação → entrega para a recepção com resumo"),
 ("b", "Perfeito, Valdir. Pelo que você contou, o caminho é uma avaliação com a Dra. pra fazer o planejamento digital e te mostrar as opções (prótese fixa sobre implantes). A Aline, da recepção, vai te passar os horários em instantes. 😊"),
 ("n", "Resumo automático para a recepção (nota interna): 'Valdir · Guabiruba · prótese total, solta e machuca · veio do anúncio de implante'. A sugestão da IA do painel pode gerar esse resumo."),
 ("h", "Valdir, aqui é a Aline. Caso como o seu a Dra. resolve com protocolo (prótese fixa que não sai). A avaliação com planejamento digital leva uns 40 minutos. Tenho quinta às 9h ou sexta às 14h. Qual fica melhor?"),
 ("c", "Quanto custa o implante?"),
 ("h", "Boa pergunta. O valor depende de quantos implantes o seu caso pede e do tipo de prótese; na avaliação a Dra. te mostra o plano com o valor exato e as formas de pagamento (parcelamos). Pra você ter ideia, casos de protocolo costumam ficar entre R$ __ e R$ __. Posso reservar quinta às 9h?"),
 ("n", "Faixa de preço e parcelamento podem ser ditos AQUI (conversa privada), nunca em anúncio (regra do CFO). A clínica define se dá a faixa ou só na avaliação. Nunca prometer resultado."),
 ("c", "Pode ser quinta"),
 ("h", "Reservado: quinta, 9h, com a Dra. Catiucia. Tem estacionamento na frente. Se tiver exames ou radiografia antigos, traz junto. 📍 (pin)"),
 ("s", "Etapa: Avaliação agendada · Lembretes 24h e 2h antes · Se não comparecer: template de remarcação no dia seguinte"),
 ("n", "Se o paciente some antes de marcar: 30 min depois o robô manda 'Ainda por aí? Posso reservar um horário?'; 24h depois, template 'Ainda posso te ajudar com a avaliação?'; 7 dias depois, última tentativa com conteúdo (vídeo da Dra. explicando o protocolo)."),
 ("n", "Depois da avaliação, se o orçamento não fechar na hora: etapa 'Orçamento enviado' e follow-up humano em 3, 15 e 30 dias (oferecer parcelamento, começar por uma etapa menor)."),
],
[("Gatilho", "Anúncio Implante/Prótese · menu 'Implante ou prótese' · palavras 'implante', 'prótese', 'dentadura', 'protocolo', 'falta dente'"),
 ("Perguntas do robô (3)", "Quantos dentes faltam · Prótese solta/machuca? · Cidade"),
 ("Humano entra", "Sempre, antes de marcar. Ticket alto exige entender o caso e falar de valor com cuidado."),
 ("Agendamento", "Humano. Não automatizar."),
 ("Etiqueta / etapa", "Implante ou Prótese · Novo → Em qualificação → Avaliação agendada → Orçamento enviado → Em tratamento"),
 ("Variação", "Se 'é para meu pai/mãe': perguntar quem vai acompanhar e anotar o decisor")],
"Robô qualifica → humano fecha")

# =====================================================================
flow("orto", "4", "Ortodontia: aparelho fixo e alinhador invisível", "Dois públicos num fluxo só: o adulto que quer alinhador e o pai ou mãe do adolescente. A primeira pergunta separa os dois.",
[
 ("c", "Quero saber sobre o alinhador invisível"),
 ("b", "Ótima escolha! 😁 Só pra eu te orientar: é para você ou para um filho(a)?", ["Para mim", "Para meu filho(a)"]),
 ("c", "Para mim"),
 ("b", "E você já tem preferência?", ["Alinhador invisível", "Aparelho fixo", "Quero que a Dra. indique"]),
 ("c", "Alinhador invisível"),
 ("b", "Perfeito. Qual a sua idade? (só pra Dra. preparar a avaliação certa)"),
 ("c", "29"),
 ("s", "Etiqueta Alinhador · Interesse = Alinhador invisível · Idade 29 · Etapa: Em qualificação"),
 ("n", "Etiquetas separadas (Alinhador x Aparelho fixo) alimentam os relatórios e o teste de anúncio que divide ortodontia em duas campanhas."),
 ("b", "Júlia, o alinhador precisa de uma avaliação com escaneamento pra Dra. ver se o seu caso pode e quanto tempo leva. Posso te passar os horários?", ["Sim, quero marcar", "Tenho uma dúvida antes"]),
 ("c", "Sim, quero marcar"),
 ("b", "A avaliação ortodôntica leva 30 min. Tenho estes horários esta semana:", ["Ter 16h", "Qui 10h", "Outro horário"]),
 ("n", "Fase 2: aqui o robô pode oferecer horários sozinho, puxando 'vagas de avaliação' que a clínica bloqueia na agenda toda semana. Na fase 1, a recepção manda os horários manualmente em até 5 minutos."),
 ("c", "Qui 10h"),
 ("b", "Reservado: quinta, 10h, com a Dra. Catiucia. 📍 Rua Sete de Setembro, 55, em frente à ponte dos bombeiros. A Aline confirma com você um dia antes. 😊"),
 ("s", "Etapa: Avaliação agendada · Consulta criada · Confirmação 24h antes com botões Sim / Preciso remarcar"),
 ("n", "Se 'Para meu filho(a)': perguntar a idade da criança e 'o dentista já indicou aparelho?' (Sim/Não). Script humano para o pai: 'a Dra. avalia se é hora de começar e explica fixo x alinhador pra adolescente'."),
 ("n", "Pergunta de preço aqui é frequente. Script: 'o alinhador varia conforme o número de placas do seu caso; na avaliação a Dra. te passa o valor fechado e o parcelamento'."),
],
[("Gatilho", "Anúncio Alinhador / Aparelho · menu 'Aparelho ou alinhador' · palavras 'aparelho', 'alinhador', 'invisalign', 'dente torto'"),
 ("Perguntas do robô (3)", "Para você ou filho? · Fixo, invisível ou indicação? · Idade"),
 ("Humano entra", "Só se o paciente pedir ('Tenho uma dúvida') ou se for para filho com queixa"),
 ("Agendamento", "Semi-automático (vagas de avaliação pré-bloqueadas) a partir da fase 2; humano na fase 1"),
 ("Etiqueta / etapa", "Alinhador ou Aparelho fixo · Novo → Avaliação agendada → Orçamento enviado → Em tratamento → Manutenção (mensal)"),
 ("Manutenção", "Paciente em tratamento recebe lembrete mensal automático da manutenção")],
"Robô qualifica e agenda (fase 2) → humano fecha o orçamento")

# =====================================================================
flow("infantil", "5", "Atendimento infantil (odontopediatria)", "Quem fala é a mãe ou o pai. O robô pergunta idade, se é a primeira vez e se há queixa. Dor vira urgência; sem queixa vira 'visita de adaptação' e pode agendar sozinho.",
[
 ("c", "Oi, queria levar minha filha no dentista, ela tem 4 anos e morre de medo"),
 ("b", "Que bom que você procurou! 💛 Aqui a Dra. Catiucia atende crianças com muita calma. Me conta: é a primeira vez dela no dentista?", ["Sim, primeira vez", "Já foi, mas teve medo"]),
 ("c", "Já foi, mas chorou muito"),
 ("b", "Entendo, acontece bastante. Ela está com alguma dor ou é só revisão?", ["Está com dor", "Só revisão / prevenção"]),
 ("c", "Só revisão"),
 ("s", "Etiqueta Odontopediatria · Idade 4 · Primeira vez = Não · Queixa = Não · Etapa: Em qualificação"),
 ("n", "Se 'Está com dor': entra na regra de urgência (recepção em 10 min, encaixe do dia). Criança com dor não espera avaliação."),
 ("b", "Então o melhor começo é a Visita de Adaptação: ela vem conhecer a cadeira, o espelhinho, ganha o carimbo do Clube do Dente Corajoso e vai embora sem nenhum procedimento. 😊 Tem horários assim:", ["Sáb 9h", "Qua 15h", "Outro horário"]),
 ("n", "'Visita de adaptação' é experiência, não preço. Pode ser sem custo, mas a palavra 'grátis' fica fora de anúncio (CFO). Na conversa privada, a recepção pode dizer que não tem custo, se a clínica decidir assim."),
 ("c", "Sáb 9h"),
 ("b", "Reservado: sábado, 9h. Dica da Dra.: fala pra ela que vai 'conhecer a casa do dentista', sem usar as palavras 'não vai doer'. 😉 Qual o nome dela?"),
 ("c", "Alice"),
 ("b", "Alice já está na agenda! 📍 Rua Sete de Setembro, 55. Até sábado!"),
 ("s", "Consulta criada · Campo Dependente = Alice (4) · Confirmação 24h antes · Pós-visita: template 'Como foi a visita da Alice?' + convite para revisão em 6 meses"),
 ("n", "Agendamento automático cabe aqui: baixo risco, sem orçamento, e a mãe decide rápido. Humano só entra se ela responder 'Outro horário' ou fizer pergunta livre."),
 ("n", "Bônus sem custo de anúncio: pacientes adultas já cadastradas com filhos recebem esse mesmo convite por template, uma vez."),
],
[("Gatilho", "Anúncio Infantil · menu 'Dentista para criança' · palavras 'filho', 'filha', 'criança', 'bebê', 'infantil'"),
 ("Perguntas do robô (3)", "Primeira vez? · Dor ou revisão? · (idade vem no texto ou pergunta extra)"),
 ("Humano entra", "Se dor (urgência) · se 'Outro horário' · se pergunta livre"),
 ("Agendamento", "Automático (visita de adaptação) desde a fase 2; humano na fase 1"),
 ("Etiqueta / etapa", "Odontopediatria · Novo → Avaliação agendada → Em tratamento → Manutenção (6 meses)"),
 ("Retenção", "'Passaporte do Sorriso': lembrete de revisão a cada 6 meses com carimbo")],
"Robô qualifica e agenda → humano só em exceção")

# =====================================================================
flow("familia", "6", "Tratamento geral e família", "Quem quer 'um dentista para todo mundo'. Fluxo curto, agendamento pode ser automático, e o objetivo é trazer 2 ou mais pessoas por conversa.",
[
 ("c", "Boa tarde, queria marcar uma limpeza pra mim e ver dentista pros meus filhos"),
 ("b", "Boa tarde! 😊 A Especitá cuida da família toda. Pra organizar: seriam quantas pessoas?", ["Só eu", "2 ou 3", "Família toda (4+)"]),
 ("c", "2 ou 3"),
 ("b", "Ótimo. E o que importa mais agora?", ["Limpeza e revisão", "Tratar algo que incomoda", "Ter um dentista fixo da família"]),
 ("c", "Limpeza e revisão"),
 ("b", "Vocês têm convênio odontológico?", ["Sim", "Não / particular"]),
 ("c", "Não"),
 ("s", "Etiqueta Família · Pessoas = 2-3 · Interesse = Revisão · Convênio = Não · Etapa: Em qualificação"),
 ("n", "Se 'Sim' para convênio: o robô informa quais a clínica aceita (lista fixa) e, se não aceitar, a recepção explica o particular. Esse 'Sim/Não' alimenta o público 'convênio empresarial' do plano de mídia."),
 ("b", "Dá pra agendar todo mundo no mesmo dia, em sequência, pra vocês virem uma vez só. Qual período é melhor?", ["Manhã", "Tarde", "Sábado"]),
 ("c", "Sábado"),
 ("h", "Oi! Aqui é a Aline. Consigo sábado 8h30, 9h e 9h30 pra vocês três. Me passa os nomes e quem são as crianças (idade) que eu já deixo tudo reservado?"),
 ("n", "Agendamento de várias pessoas é humano (encaixe de horários consecutivos). Para 'Só eu' + revisão, o robô pode marcar sozinho na fase 2."),
 ("c", "Luciana, Pedro (13) e Marina (9)"),
 ("h", "Reservado: sábado, 8h30 Luciana, 9h Pedro, 9h30 Marina, com a Dra. Catiucia. 📍 Rua Sete de Setembro, 55, em frente à ponte dos bombeiros. Confirmo com vocês na sexta."),
 ("s", "3 consultas criadas · Campo Dependentes · Confirmação 24h antes · Pós: 'Passaporte do Sorriso' para a família (revisão em 6 meses)"),
 ("n", "Métrica desse fluxo: pacientes por conversa (meta ≥ 2). É o fluxo mais barato por paciente da clínica."),
],
[("Gatilho", "Menu 'Avaliação / check-up' com 2+ pessoas · palavras 'família', 'limpeza', 'revisão', 'filhos'"),
 ("Perguntas do robô (3)", "Quantas pessoas · O que importa · Convênio?"),
 ("Humano entra", "Quando há mais de uma pessoa (horários consecutivos) ou convênio não aceito"),
 ("Agendamento", "Automático para 1 pessoa (fase 2); humano para família"),
 ("Etiqueta / etapa", "Família · Novo → Avaliação agendada → Em tratamento → Manutenção"),
 ("Retenção", "Lembrete de revisão 6 em 6 meses para cada membro")],
"Robô qualifica → humano agenda a família")

# =====================================================================
flow("hof", "7", "Harmonização facial", "Conversa sempre guiada por humano depois da qualificação. Enquanto a situação jurídica (TRF1, ago/2026) não for confirmada com o CRO-SC, só atender quem procura; não disparar campanha nova.",
[
 ("c", "Vi o anúncio do botox, queria saber valores"),
 ("s", "Origem = Anúncio Botox · Etiqueta Harmonização · Nome coletado"),
 ("b", "Oi, Patrícia! 😊 A Dra. Catiucia é cirurgiã-dentista com habilitação em Harmonização Orofacial e faz aqui em Brusque. Pra te orientar: o que você quer melhorar?", ["Rugas de expressão (testa, olhos)", "Volume (lábios, olheiras)", "Contorno / qualidade da pele"]),
 ("c", "Rugas de expressão"),
 ("b", "Já fez algum procedimento estético antes?", ["Sim", "Não, seria a primeira vez"]),
 ("c", "Não, primeira vez"),
 ("b", "Tem alguma data importante chegando (casamento, formatura, evento)?", ["Sim", "Não"]),
 ("c", "Casamento em dezembro"),
 ("s", "Interesse = Botox · Primeira vez = Sim · Evento = Casamento dez · Etiqueta Noiva · Etapa: Em qualificação → recepção"),
 ("n", "A pergunta do evento define urgência e o plano: botox precisa de 15 dias para o resultado final; a recepção usa isso para sugerir a data."),
 ("h", "Patrícia, aqui é a Aline. Que legal, parabéns pelo casamento! 🎉 Pra primeira vez, a Dra. faz uma avaliação facial de uns 30 min: ela analisa seu rosto, explica o que o botox faz e o que não faz, e monta o plano com valor fechado. Pensando em dezembro, o ideal é avaliar nas próximas 2 semanas. Tenho quarta 14h ou sexta 10h."),
 ("c", "E o valor do botox?"),
 ("h", "O valor depende das regiões e da quantidade de pontos; na avaliação sai o valor exato. Pra você ter uma referência, a região da testa e olhos costuma ficar entre R$ __ e R$ __, e parcelamos. Quarta 14h fica bom?"),
 ("n", "Nunca prometer resultado ('vai ficar natural', 'some a ruga'). Falar de abordagem: 'a Dra. prioriza um resultado discreto'. Termo de consentimento assinado na avaliação, antes de qualquer procedimento."),
 ("c", "Quarta 14h"),
 ("h", "Reservado: quarta, 14h, avaliação facial com a Dra. Catiucia. 📍 Rua Sete de Setembro, 55. Vem sem maquiagem pesada, se puder. 😊"),
 ("s", "Etapa: Avaliação agendada · Confirmação 24h antes · Pós-procedimento: retorno em 15 dias (template) · Reativação em 4 a 6 meses"),
 ("n", "Retenção é onde está o lucro da harmonização: template automático aos 4 meses ('está na hora de reavaliar') traz o paciente de volta sem anúncio."),
],
[("Gatilho", "Anúncio Botox (campanha atual) · menu 'Harmonização facial' · palavras 'botox', 'harmonização', 'preenchimento', 'ruga', 'lábio'"),
 ("Perguntas do robô (3)", "O que quer melhorar · Já fez? · Data importante?"),
 ("Humano entra", "Sempre, antes de falar de valor ou de marcar"),
 ("Agendamento", "Humano"),
 ("Etiqueta / etapa", "Harmonização (+ Noiva / Masculino) · Novo → Avaliação agendada → Em tratamento → Manutenção (4-6 meses)"),
 ("Alerta", "Confirmar com CRO-SC a situação pós-TRF1 antes de qualquer campanha nova; o atendimento de quem procura segue")],
"Robô qualifica → humano conduz tudo")

# =====================================================================
flow("checkup", "8", "Avaliação / check-up ('Dentista em Brusque')", "Quem chegou na cidade ou está há tempo sem ir ao dentista. É o fluxo mais simples e o melhor candidato a agendamento 100% automático.",
[
 ("c", "Olá, mudei pra Brusque e estou procurando dentista"),
 ("b", "Seja bem-vinda a Brusque! 😊 A Especitá fica no Santa Rita, em frente à ponte dos bombeiros. Faz quanto tempo que você não vai ao dentista?", ["Menos de 1 ano", "1 a 2 anos", "Mais de 2 anos"]),
 ("c", "Mais de 2 anos"),
 ("b", "Sem problema, a gente começa do começo. Está sentindo algo incomodando?", ["Sim, algo incomoda", "Não, só quero revisar"]),
 ("c", "Não, só revisar"),
 ("s", "Etiqueta Novo em Brusque · Tempo sem dentista = 2+ anos · Queixa = Não · Etapa: Em qualificação"),
 ("n", "Se 'Sim, algo incomoda': perguntar 'dói?' (Sim/Não); se dói, vira urgência."),
 ("b", "Então o próximo passo é uma avaliação completa com a Dra. Catiucia (uns 40 min, com fotos e radiografia se precisar). Posso marcar?", ["Qua 9h", "Sex 15h", "Outro horário"]),
 ("c", "Sex 15h"),
 ("b", "Reservado: sexta, 15h. Qual seu nome completo?"),
 ("c", "Ana Paula Ferreira"),
 ("b", "Ana Paula, está na agenda! 📍 (pin do mapa) · tem estacionamento na frente. Um dia antes eu te mando a confirmação. Até sexta! 😊"),
 ("s", "Consulta criada · Confirmação 24h antes (Sim / Preciso remarcar) · Lembrete 2h antes · Pós-consulta: satisfação → Google"),
 ("n", "Agendamento automático aqui é seguro: ticket baixo, sem orçamento prévio, e quem é novo na cidade valoriza resolver na hora. É o fluxo para testar a integração de agenda primeiro."),
 ("n", "Prova social permitida: 'mais de 10 anos em Brusque', número de avaliações no Google, fotos reais da clínica. Sem depoimentos republicados."),
],
[("Gatilho", "Menu 'Avaliação / check-up' · anúncio Avaliação · palavras 'avaliação', 'check-up', 'mudei', 'novo na cidade', 'dentista em brusque'"),
 ("Perguntas do robô (2)", "Tempo sem dentista · Algo incomoda?"),
 ("Humano entra", "Só se queixa com dor, 'Outro horário' ou pergunta livre"),
 ("Agendamento", "Automático (candidato número 1 para integrar a agenda)"),
 ("Etiqueta / etapa", "Novo em Brusque / Check-up · Novo → Avaliação agendada → Em tratamento → Manutenção"),
 ("Pós", "Satisfação 24h → Google; revisão em 6 meses")],
"Robô qualifica e agenda sozinho")

# =====================================================================
COMMON = [
 ("Fora do horário", [
   ("c", "Boa noite, quanto custa clareamento?"),
   ("b", "Boa noite! 😊 Aqui é a Especitá. Agora estamos fora do horário (atendemos seg a sex 8h às 18h e sáb 8h às 12h). Já anotei sua pergunta: amanhã às 8h a recepção te responde por aqui. Se for dor forte, responda URGENTE."),
   ("s", "Conversa marcada 'Sem resposta' para a fila da manhã · Etiqueta pelo assunto (Clareamento)"),
   ("n", "A pergunta não se perde: entra na fila 'Sem resposta' do painel com a etiqueta do assunto, e a recepção abre o dia respondendo a fila, não a caixa de entrada toda."),
 ]),
 ("Sem resposta do paciente", [
   ("b", "Oi, Felipe! Ainda por aí? Posso reservar um dos horários pra você? 😊"),
   ("s", "30 min sem resposta, dentro da janela de 24h"),
   ("t", "Olá, Felipe! Aqui é a Especitá. Ainda posso te ajudar com a avaliação de implante? Responda esta mensagem e continuamos por aqui."),
   ("s", "24h depois (template utilitário aprovado) · 7 dias depois: última tentativa com vídeo da Dra. · depois, etiqueta 'Esfriou' e entra na campanha de reativação em 90 dias"),
   ("n", "Esse bloco é o 'nó de espera' que o motor do painel ainda não tem. É a primeira peça a construir depois dos fluxos."),
 ]),
 ("Confirmação de consulta", [
   ("t", "Olá, Júlia! Lembrando sua avaliação amanhã, quinta, às 10h, com a Dra. Catiucia, na Rua Sete de Setembro, 55. Você confirma?"),
   ("b", "", ["Confirmo ✅", "Preciso remarcar"]),
   ("c", "Confirmo ✅"),
   ("b", "Combinado! Te esperamos amanhã às 10h. 📍 (pin)"),
   ("s", "Status da consulta = Confirmada (tela Hoje) · 2h antes: lembrete curto · 'Preciso remarcar' → recepção oferece 2 horários e libera a vaga"),
   ("n", "Reduz faltas em até 40% segundo os softwares do setor. Sem resposta até 2h antes: a recepção liga."),
 ]),
 ("Pós-consulta e avaliação no Google", [
   ("t", "Oi, Ana Paula! Como foi sua consulta ontem com a Dra. Catiucia? De 0 a 10, o quanto você nos indicaria?"),
   ("c", "10"),
   ("b", "Que alegria! 💛 Se puder, deixa sua avaliação no Google, leva 1 minuto e ajuda muito a clínica: (link). Obrigada!"),
   ("s", "Nota 9-10 → link do Google · Nota 7-8 → agradece · Nota ≤ 6 → alerta para a Dra. ligar no mesmo dia"),
   ("n", "Mais avaliações no Google = anúncio mais barato e mais gente escolhendo a clínica no mapa."),
 ]),
 ("Orçamento não aprovado", [
   ("h", "Oi, Felipe! Aqui é a Aline. A Dra. ficou de te passar: dá pra começar o tratamento pela etapa 1 e dividir o restante. Quer que eu simule as parcelas?"),
   ("s", "3 dias depois da avaliação, etapa 'Orçamento enviado' · 15 dias: segunda tentativa (vídeo da Dra. sobre o procedimento) · 30 dias: última, com condição de agenda"),
   ("n", "É onde o dinheiro da clínica fica parado. O painel mostra o cartão em âmbar e cria a tarefa para a recepção; a mensagem é humana."),
 ]),
 ("Reativação (6 meses sem consulta)", [
   ("t", "Oi, Letícia! Faz um tempinho que não te vemos na Especitá 🙂 Que tal uma revisão com a Dra. Catiucia? A agenda de novembro abriu esta semana."),
   ("b", "", ["Quero agendar", "Agora não"]),
   ("s", "Campanha mensal pela tela de Campanha (segmento 'sem consulta há 6 meses') · 'Quero agendar' cai em Sem resposta com etiqueta Reativação · 'Agora não' → etiqueta Não enviar por 90 dias"),
   ("n", "Retorno típico de 12 a 18%. Respeitar o limite de 250 conversas/dia até a empresa ser verificada."),
 ]),
]

# ---------- montagem ----------
css = r"""
:root{--bg:#F4F7F6;--ink:#17302B;--muted:#6B7F7A;--line:#DCE5E2;--acc:#0E7C6B;--amb:#B8690F;--wa:#075E54;--wa2:#DCF8C6;--note:#FFF4C2;--note-b:#E8CE6A;--tpl:#E3ECFA}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Instrument Sans",system-ui,Arial,sans-serif;font-size:15px;line-height:1.5}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 80px}
h1,h2,h3{font-family:"Bricolage Grotesque",system-ui,Arial,sans-serif;line-height:1.1;margin:0}
h1{font-size:40px;font-weight:800}
h2{font-size:28px;font-weight:700;margin:56px 0 8px;padding-top:20px;border-top:1px solid var(--line)}
h3{font-size:18px;font-weight:700}
.eyebrow{color:var(--acc);font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}
.lede{color:var(--muted);font-size:17px;max-width:760px;margin:8px 0 0}
.meta{color:var(--muted);font-size:13px;margin-top:10px}
table{border-collapse:collapse;width:100%;font-size:14px;margin:14px 0}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:#E8EFEC;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.chip{display:inline-block;font-size:12px;font-weight:700;padding:2px 9px;border-radius:999px;background:#E3F3EF;color:#0A5F53;white-space:nowrap}
.chip.h{background:#FDF0DC;color:var(--amb)}.chip.a{background:#E8ECEB;color:#3F5551}
.grid{display:grid;grid-template-columns:390px minmax(0,1fr);gap:24px;align-items:start;margin-top:18px}
@media (max-width:860px){.grid{grid-template-columns:minmax(0,1fr)}}
.phone{width:390px;max-width:100%;border:10px solid #1B2A27;border-radius:36px;overflow:hidden;background:#ECE5DD;box-shadow:0 12px 40px rgba(0,0,0,.18)}
.ph-top{background:var(--wa);color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px}
.ph-top .av{width:34px;height:34px;border-radius:50%;background:#0E7C6B;display:grid;place-items:center;font-weight:800}
.ph-top b{display:block;font-size:14px}.ph-top small{font-size:11px;opacity:.85}
.ph-body{padding:12px 10px;display:flex;flex-direction:column;gap:7px;background:#ECE5DD url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='1' fill='%23d9d0c5'/%3E%3C/svg%3E")}
.ph-foot{background:#F0F0F0;padding:10px 14px;color:#999;font-size:13px;border-top:1px solid #ddd}
.m{max-width:86%;padding:7px 10px;border-radius:10px;font-size:13.5px;line-height:1.4;box-shadow:0 1px 1px rgba(0,0,0,.08);background:#fff;white-space:normal}
.m .who{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#7A8B86;margin-bottom:2px}
.m.c{align-self:flex-start;border-top-left-radius:2px}
.m.b{align-self:flex-end;background:var(--wa2);border-top-right-radius:2px}
.m.b .who{color:#2F7D4F}
.m.h{align-self:flex-end;background:#C9EEDF;border-top-right-radius:2px}
.m.h .who{color:#0A5F53}
.m.t{align-self:flex-end;background:var(--tpl);border-top-right-radius:2px}
.m.t .who{color:#2A57B2}
.btns{display:flex;flex-direction:column;gap:4px;margin-top:6px}
.btn{background:#fff;border:1px solid #BFD8D0;color:#0A7CFF;text-align:center;border-radius:7px;padding:5px 8px;font-size:12.5px;font-weight:600}
.note{align-self:stretch;background:var(--note);border:1px solid var(--note-b);border-left:5px solid #D9B43A;border-radius:8px;padding:7px 10px;font-size:12.5px;color:#4D3E00;line-height:1.4}
.sys{align-self:center;background:#DDE7E3;color:#3F5551;font-size:11px;padding:4px 10px;border-radius:999px;text-align:center;max-width:95%}
.rules{background:#fff;border:1px solid var(--line);border-radius:14px;padding:6px 16px}
.rule{display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid var(--line);font-size:14px}
.rule:last-child{border-bottom:0}
.rule span{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em;font-weight:700;padding-top:2px}
.mode{display:inline-block;margin:10px 0 0;background:#0F2A26;color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;font-size:12.5px}
.legend span{padding:4px 10px;border-radius:8px;border:1px solid var(--line);background:#fff}
.legend .lb{background:var(--wa2)}.legend .lh{background:#C9EEDF}.legend .lt{background:var(--tpl)}.legend .ln{background:var(--note)}.legend .ls{background:#DDE7E3}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.toc a{font-size:13px;color:var(--acc);text-decoration:none;border:1px solid var(--line);background:#fff;padding:5px 10px;border-radius:999px}
.common{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:20px;margin-top:16px}
.common .phone{width:100%}
.common h3{margin:0 0 8px}
.box{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-top:14px}
.box ul{margin:6px 0 0;padding-left:18px}
.box li{margin:4px 0}
"""

parts = [f'<title>Fluxos de WhatsApp Especitá</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=Instrument+Sans:wght@400;600;700&display=swap">\n<style>{css}</style>\n<div class="wrap">']
parts.append('''
<p class="eyebrow">Plano de implementação · WhatsApp API oficial · outubro 2026</p>
<h1>Fluxos de WhatsApp da Especitá</h1>
<p class="lede">Um fluxo para cada produto da clínica: o robô (SDR) qualifica em até 3 perguntas, a recepção fecha, e o agendamento vai ficando automático onde é seguro. Cada tela mostra a conversa como o paciente vê, mais as notas amarelas com o que a recepção faz ou o que o painel precisa implementar.</p>
<p class="meta">Telefones são simulações; nomes são fictícios. Valores "R$ __" são para a clínica preencher. Regras de publicidade do CFO valem para anúncio; na conversa privada a clínica pode falar de valor e parcelamento, mas nunca promete resultado.</p>
<div class="legend"><span class="lb">🤖 Automático (robô/SDR)</span><span class="lh">👩 Recepção (humano)</span><span class="lt">📨 Template fora da janela de 24h</span><span class="ln">💡 Nota amarela: sugestão para humano ou implementação</span><span class="ls">⚙ O que o painel grava (etiqueta, etapa, campo)</span><span>Paciente (balão branco)</span></div>
''')
parts.append('<div class="toc">' + "".join(f'<a href="#{f["id"]}">{f["num"]} · {html.escape(f["title"])}</a>' for f in FLOWS) + '<a href="#comuns">Blocos comuns</a><a href="#implementacao">Como implementar</a></div>')

parts.append('''
<h2>Recomendação: onde o robô para e o humano entra</h2>
<p class="lede">Benchmark do setor: lead que recebe resposta em até 5 minutos converte muito mais; pelo WhatsApp cerca de 18% dos leads viram consulta, contra 12% por formulário; mais de 3 perguntas automáticas derrubam a conclusão do fluxo. Com isso, a divisão fica assim:</p>
<table><tr><th>Produto</th><th>Robô (SDR) faz</th><th>Humano faz</th><th>Agendamento</th><th>Por quê</th></tr>
<tr><td>Dente quebrado · Dor de dente</td><td>Acalma, triagem (dói? inchaço?), foto, nome</td><td>Encaixe do dia em até 10 min</td><td><span class="chip h">Humano</span></td><td>Precisa de encaixe real; erro aqui perde o paciente mais quente</td></tr>
<tr><td>Implante · Prótese</td><td>3 perguntas de caso + cidade, resumo para a recepção</td><td>Avaliação, valor, parcelamento, orçamento</td><td><span class="chip h">Humano</span></td><td>Ticket alto; conversa de valor exige pessoa</td></tr>
<tr><td>Harmonização</td><td>3 perguntas (objetivo, já fez, evento)</td><td>Tudo depois disso</td><td><span class="chip h">Humano</span></td><td>Sensível (CFO + decisão TRF1); nunca prometer resultado</td></tr>
<tr><td>Ortodontia</td><td>Separa adulto/filho e fixo/alinhador, oferece vagas</td><td>Dúvidas e orçamento</td><td><span class="chip">Semi-automático</span></td><td>Vagas de avaliação pré-bloqueadas; baixo risco</td></tr>
<tr><td>Infantil</td><td>Idade, primeira vez, queixa; agenda visita de adaptação</td><td>Só se dor ou pergunta livre</td><td><span class="chip">Automático (fase 2)</span></td><td>Sem orçamento, decisão rápida da mãe</td></tr>
<tr><td>Família / geral</td><td>Quantas pessoas, interesse, convênio</td><td>Horários consecutivos para a família</td><td><span class="chip">Automático p/ 1 pessoa</span></td><td>Várias pessoas = encaixe manual</td></tr>
<tr><td>Check-up / novo em Brusque</td><td>Tempo sem dentista, queixa, agenda</td><td>Só exceções</td><td><span class="chip">Automático</span></td><td>Melhor fluxo para testar a integração de agenda primeiro</td></tr>
</table>
<div class="box"><b>Em três fases</b><ul>
<li><b>Fase 1 (lançamento):</b> robô qualifica e entrega para a recepção em todos os fluxos; a recepção manda 2 horários em até 5 min. Nenhum agendamento automático ainda.</li>
<li><b>Fase 2 (30 a 60 dias):</b> a clínica bloqueia "vagas de avaliação" na agenda toda semana; o robô oferece essas vagas nos fluxos Check-up, Infantil, Ortodontia e Família (1 pessoa). A recepção só confirma.</li>
<li><b>Fase 3 (90 dias+):</b> integração real com a agenda da clínica; confirmação, lembrete, pós-consulta e reativação rodando sozinhos. Implante, urgência e harmonização continuam com humano no fechamento.</li>
</ul></div>
''')

for f in FLOWS:
    parts.append(f'<section id="{f["id"]}"><h2>{f["num"]} · {html.escape(f["title"])}</h2><p class="lede">{html.escape(f["lede"])}</p><span class="mode">{html.escape(f["mode"])}</span><div class="grid">{phone(f["title"], f["items"])}<div class="rules">{rules(f["rows"])}</div></div></section>')

parts.append('<section id="comuns"><h2>Blocos comuns a todos os fluxos</h2><p class="lede">Fora do horário, paciente que some, confirmação de consulta, pós-consulta, orçamento parado e reativação. São os mesmos para qualquer produto; mudam só a etiqueta e o texto.</p><div class="common">')
for title, items in COMMON:
    parts.append(f'<div><h3>{html.escape(title)}</h3>{phone(title, items)}</div>')
parts.append('</div></section>')

parts.append('''
<section id="implementacao"><h2>Como implementar no painel</h2>
<div class="box"><b>O que já existe no painel e serve direto</b><ul>
<li>Motor de fluxo dinâmico (fluxos guardados no banco, não em código): nó de mensagem com botões, nó de ação que grava etiqueta e etapa do pipeline, gatilho por palavra-chave e por primeiro contato.</li>
<li>Etiquetas, etapas do pipeline, campos personalizados (Interesse, Origem, Convênio, Cidade, Dependentes), notas internas, retornos agendados, respostas prontas com "/".</li>
<li>Envio de templates aprovados na Meta (campanhas) e horário comercial com resposta automática.</li>
</ul></div>
<div class="box"><b>O que falta construir, em ordem</b><ul>
<li><b>Nó de espera / lembrete</b> no motor de fluxo ("se não responder em 30 min, manda X; em 24h, manda template Y"). É o bloco "Sem resposta do paciente" e aparece em todos os fluxos.</li>
<li><b>Mensagem de lista</b> (até 10 opções) além dos botões (até 3), para o menu da porta de entrada.</li>
<li><b>Texto pré-preenchido por anúncio</b> virando Origem + etiqueta automaticamente (gatilho por palavra-chave já cobre; falta o cadastro dos textos por campanha).</li>
<li><b>Resumo para a recepção</b> ao entregar a conversa (a sugestão da IA do painel, já em construção, pode gerar).</li>
<li><b>Cadastro simples de consulta</b> (paciente, dia, hora, dentista) para alimentar confirmação 24h/2h e a tela Hoje. Pré-requisito da fase 2.</li>
<li><b>Vagas de avaliação</b> pré-bloqueadas que o robô oferece (fase 2) e, depois, integração com a agenda da clínica (fase 3).</li>
<li><b>Templates utilitários</b> a aprovar na Meta: confirmação de consulta, lembrete 2h, "ainda posso ajudar?", pós-consulta 0-10, retorno de 15 dias (HOF), revisão 6 meses, reativação.</li>
</ul></div>
<div class="box"><b>Regras que valem em todo fluxo</b><ul>
<li>No máximo 3 perguntas automáticas antes do humano. Nome é a última.</li>
<li>Toda entrega ao humano gera: etiqueta do produto, etapa "Em qualificação", nota com o resumo, e alerta na fila "Sem resposta" com tempo correndo. Meta: 5 min em horário comercial; 10 min em urgência.</li>
<li>Robô nunca dá diagnóstico, remédio ou promessa de resultado. Primeiros socorros só em texto fixo aprovado pela Dra.</li>
<li>Valor e parcelamento: só na conversa, nunca em anúncio. Faixa de preço é decisão da clínica.</li>
<li>Toda primeira conversa termina com o pin da localização e "em frente à ponte dos bombeiros".</li>
<li>Opt-out em toda campanha ("responda SAIR"), limite de 250 conversas/dia até a verificação da empresa, consentimento LGPD registrado no contato.</li>
</ul></div>
</section>
</div>''')

io.open(OUT, "w", encoding="utf-8").write("\n".join(parts))
print("ok", OUT, len(FLOWS), "fluxos", len(COMMON), "blocos comuns")
