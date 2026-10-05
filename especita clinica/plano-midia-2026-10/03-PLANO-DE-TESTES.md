# 03 · Plano de testes — um produto de cada vez, como se fossem negócios separados

Método: cada serviço é tratado como um produto com oferta, público, criativo e meta próprios.
Testa-se **uma variável por vez** (primeiro criativo, depois público, depois oferta), 14 dias por
rodada, orçamento separado do que já roda. A decisão é sempre pelo **custo por paciente que
agendou e compareceu**, não por custo por lead. Benchmarks reais da própria conta em 2026:
botox R$ 17,26/lead · prótese R$ 19,42/conversa · clareamento R$ 26,10 · ortodontia R$ 40,30.

## Regras do teste
- Teste A/B nativo do Gerenciador (divide público sem sobreposição). 2 variações, nunca 4.
- R$ 30–40/dia por variação. Mínimo 7 dias, ideal 14. Precisa de ~50 resultados por variação para a Meta sair do aprendizado; se não chegar, ler tendência e decidir mesmo assim.
- Critério de parada antecipada: CPL 2× o benchmark do produto por 4 dias seguidos → pausar a variação perdedora.
- Toda rodada entra na planilha `05-CRONOGRAMA-E-MEDICAO.md` com hipótese, resultado e decisão.
- No WhatsApp (painel): etiqueta automática por campanha, resposta em até 5 min, pergunta de qualificação, dois horários concretos. Sem isso o teste mede a recepção, não o anúncio.

## Ordem das rodadas (prioridade = provou ROI × ticket × sazonalidade)

| Rodada | Produto | Por que agora |
|---|---|---|
| 1 (semana 1–2) | **Botox / Harmonização** | Melhor CPL da conta; criativo cansado (frequência 4,3) |
| 1 (paralelo) | **Clareamento** | Sazonal: festas, casamentos e formaturas out–dez |
| 2 (semana 3–4) | **Prótese protocolo / Implante** | Ticket mais alto; R$ 19,42 provado; 13º salário em nov–dez |
| 2 (paralelo) | **Ortodontia dividida** | Corrigir o pior CPL ou pausar |
| 3 (semana 5–6) | **Urgência** | Nunca rodou na Meta; alta intenção; sustenta o Google |
| 3 (paralelo) | **Odontopediatria** | Nunca rodou; férias de dezembro–janeiro |
| 4 (semana 7–8) | **Lente de contato** e **Harmonização masculina** | Expansão de ticket e de público |
| Sempre ligada | **Avaliação / Dentista em Brusque** | Rede de segurança, R$ 10/dia |

## Matriz de testes por produto

### Botox / Harmonização facial
**Só rodar testes novos depois da confirmação do CRO-SC sobre a decisão do TRF1 (19/08/2026). Até lá, a campanha atual segue como está.**
| Teste | A | B | Métrica | Meta |
|---|---|---|---|---|
| T1 Criativo | Dra. explicando em 20 s "o que o botox faz e o que não faz" | Mito x verdade em 15 s ("botox deixa o rosto parado?") | CPL + taxa de agendamento | CPL ≤ R$ 17 e ≥ 30% agendam |
| T2 Destino | Formulário nativo com 3 perguntas | Mensagens → WhatsApp | custo por avaliação agendada | menor custo por agendamento |
| T3 Oferta | "Avaliação facial com plano personalizado" | "Turma de outubro: 10 vagas de avaliação com a Dra. nesta semana" (escassez de agenda, sem preço/desconto) | CPL + fechamento | fechamento ≥ 25% |
| T4 Público | Advantage+ amplo (mulheres 28–55, 15 km) | Noivas + interesses de estética | CPL | diferença > 20% decide |

### Clareamento (e lente de contato como variação de ticket)
| Teste | A | B | Métrica |
|---|---|---|---|
| T1 Criativo | "Sorriso branco para as festas" com agenda de dezembro aberta | Dra. em 15 s: "clareamento de farmácia x personalizado" | custo por conversa |
| T2 Público | Noivas e formandos (eventos de vida) | Amplo 20–45 Brusque | custo por conversa |
| T3 Upsell | No WhatsApp: oferecer lente de contato para quem pergunta "dente manchado/quebrado" | — | ticket médio |

### Prótese protocolo / Implante
| Teste | A | B | Métrica |
|---|---|---|---|
| T1 Criativo | Dor: "prótese que solta, machuca, não mastiga" (vídeo da Dra.) | Ganho: "voltar a comer de tudo" (Dra. conta um caso sem identificar o paciente) | custo por conversa qualificada |
| T2 Oferta | Avaliação com planejamento digital | "A Dra. explica as etapas em 30 min" (sem citar preço ou parcelamento: vedado pelo CFO; condições só no WhatsApp) | agendamento |
| T3 Público | 45+ amplo Brusque e vizinhas | Filhos adultos 30–50 (quem decide pelos pais) | CPL e qualidade |
| Qualificação obrigatória no WhatsApp | quantos dentes faltam · usa prótese móvel · há quanto tempo · bairro | | |

### Ortodontia (dividida)
| Conjunto | Público | Criativo | Meta |
|---|---|---|---|
| Alinhador invisível | 22–40, Brusque, interesses de estética/carreira | "Aparelho que ninguém vê" com a Dra. mostrando o alinhador | CPL < R$ 30 |
| Aparelho fixo | Pais 35–50 e jovens 16–24 | "Aparelho do filho: quando começar?" | CPL < R$ 30 |
| Se nenhum bater a meta em 14 dias | pausar Meta; ortodontia fica só no Google (busca de alta intenção) | | |

### Urgência (dente quebrado / dor de dente)
| Teste | A | B | Métrica |
|---|---|---|---|
| T1 Canal | Google Pesquisa (dor de dente, dentista 24h, dente quebrado) | Meta Mensagens, 24h/dia, criativo "dor de dente não espera" | custo por conversa e tempo de resposta |
| T2 Criativo | Texto puro, direto ("atendimento hoje em Brusque") | Vídeo 10 s da recepção/consultório | custo por conversa |
| Regra | só rodar se a clínica garantir resposta em 10 min e encaixe no mesmo dia | | |

### Odontopediatria
| Teste | A | B | Métrica |
|---|---|---|---|
| T1 Ângulo | "Clube do Dente Corajoso": medo e ansiedade (mães 28–42) | "Primeiro Dentinho": bebê 6–12 meses, visita de boas-vindas | CPL |
| T2 Criativo | Vídeo do consultório com criança brincando (consentido) | Dra. respondendo "com que idade levar ao dentista?" | CPL |
| T3 Decisor | Mãe | Pai | CPL |
| Base grátis | pacientes adultas com filhos (lista do painel) recebem convite por WhatsApp antes do anúncio | | |

### Harmonização masculina
| Teste | A | B |
|---|---|---|
| Criativo | "Botox para homem: discreto, 15 minutos" (sem rosto feminino) | Dra. respondendo "homem faz botox?" |
| Público | Homens 28–50 Brusque amplo | Homens com interesse em academia/barbearia |

### Avaliação / Dentista em Brusque (sempre ligada)
Dois anúncios, 5 públicos do capítulo 5 das "Campanhas Especitá" (mulheres 30–55 renda mais alta; convênio empresarial; recém-chegados; dor represada; +1 ano sem dentista). Começar pelos públicos 1 e 4. R$ 10/dia, Mensagens, sem A/B: é rede de segurança.

## O que a clínica precisa entregar para os testes acontecerem
- 10 fotos de antes/depois com termo de consentimento assinado (clareamento, prótese, lente): uso só no orgânico.
- 2 horas de gravação com a Dra. (roteiros em `04-CRIATIVOS-E-CONTEUDO.md`).
- 3 pacientes dispostos a dar depoimento de 20–40 s (uso interno/apresentação; não entram em anúncio, por prudência com o CFO).
- Lista de pacientes (nome, telefone, procedimento, última consulta) para públicos personalizados e campanhas de base.
- Horários de "encaixe de urgência" reservados na agenda (ex.: 1 por turno).
