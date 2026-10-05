# 01 · Auditoria campanha por campanha — o que manter, alterar e pausar

Base: extrações de 03/10/2026 (Google Ads 113-943-9321; Meta 638556319545340 e 991888939034732),
histórico de anúncios jan–out/2026 e o playbook `ads-odonto`. Nada aqui foi aplicado nas contas.
Regra do plano: **nunca desligar o que traz paciente hoje sem o substituto rodando ao lado.**

## 0. Achado que muda a conversa: existem DUAS contas de anúncio na Meta

| Conta | O que tem | Situação |
|---|---|---|
| **991888939034732** "CA – Dra Catiucia [ESPECITA]" | Campanhas estruturadas de 2026: botox, ortodontia, clareamento, prótese protocolo, comece o ano | É daqui que vem o gasto real de R$ 44–71/dia visto em 03/10: **botox (R$ 25/dia, ativa) + ortodontia (R$ 25/dia, aprendizado limitado)** somam R$ 50/dia. É a conta que funciona. |
| **638556319545340** (portfólio "Dra Catiucia Lanzzarin") | 74 campanhas de "Impulsionar publicação", 92 anúncios, quase todos **rejeitados ou com erro**, R$ 0 de gasto nos últimos 30 dias | Lixo operacional da gestão anterior. Pausar/arquivar tudo, não investir nela. |

Para a reunião: a clínica não "parou de anunciar"; ela tem uma conta boa com duas campanhas vivas
e uma conta cheia de posts impulsionados quebrados. O trabalho é concentrar tudo na conta boa.

## 1. Google Ads

### 1.1 `[pesquisa] 18/08 dentista` — MANTER e reorganizar

| Dado | Valor |
|---|---|
| Status | Ativa, "limitada pelo orçamento" (R$ 65/dia), CPA desejado |
| Cliques / conversões | 631 / 27 (CPA R$ 74,36, com rastreio duvidoso) |
| Melhor palavra | `"implantes dentarios"`: CTR 37,5%, CPA R$ 10,50 |
| Dispositivo | 26 de 27 conversões em celular |
| Anúncio | 1 RSA, qualidade "Bom", título "Está faltando dentes? Dentista de implantes" |

**O que está errado**
- Um grupo de anúncios só, com palavras de implante, infantil, dor, clínica e "dentista" juntas. O anúncio fala de implante para quem buscou "dentista infantil".
- Palavras `"dentista infantil"`, `"odontopediatria"`, `"dor no dente"`, `"dentista perto de mim"` com zero impressão: correspondência de frase + volume baixo em Brusque, e o anúncio não é relevante para elas.
- Sem públicos (nem remarketing, nem lista de pacientes), sem programação por horário, sem recursos de chamada/WhatsApp confirmados.
- Rastreio: `Lead Formulário` (419) e `[Lead][Botão WPP]` (18) com "Requer atenção" e valor zero; `FORM SITE` fora das metas; `Local actions – Directions` (107) inflando o total.

**O que fazer (semana 1 e 2)**
1. Corrigir conversões: primárias = clique no WhatsApp, envio de formulário, ligação; secundária (observação) = rotas. Atribuir valor (ex.: WhatsApp R$ 30, formulário R$ 30, ligação R$ 50) para o Smart Bidding aprender.
2. Reestruturar em grupos por serviço, cada um com seu anúncio: **Implante e prótese** · **Urgência** (dor de dente, dente quebrado, dentista 24 horas) · **Clareamento** · **Odontopediatria** · **Botox e harmonização** · **Ortodontia e alinhador** · **Geral Brusque** (dentista em Brusque, clínica odontológica Brusque). Lista completa em `02-PUBLICOS-E-PERSONAS.md`.
3. Negativas: grátis, SUS, curso, faculdade, vaga, emprego, salário, quanto ganha, concurso, técnico, auxiliar, plano odontológico barato, Blumenau/Itajaí (até decidir cobrir).
4. Recursos: chamada (horário comercial), local (Perfil da Empresa), sitelinks (Implante, Urgência, Harmonização, Infantil), frases de destaque (Encaixe de urgência, Avaliação com planejamento digital, Em frente à ponte dos bombeiros; nunca preço ou parcelamento, vedados pelo CFO), recurso de mensagem/WhatsApp.
5. Programação: reforço +20% seg–sex 8h–20h e sáb 8h–13h (mapa de dia e hora da conta mostra concentração 8h–21h em dias úteis); sem anúncio 0h–6h.
6. Orçamento: manter R$ 65/dia até o rastreio estar confiável por 14 dias; depois subir para R$ 90–100/dia, porque a campanha está limitada por orçamento e perde impressões de alta intenção.
7. Local: Brusque + Guabiruba + Botuverá (raio 15 km), "pessoas em ou que mostram interesse regularmente"; excluir "interesse em" distante.

### 1.2 `[pesquisa 28/07]` — MANTER PAUSADA

CPA R$ 265, `"dentista brusque"` com índice de qualidade 3/10 gastou R$ 927 para 3 conversões. Não
reativar. As únicas palavras que valem voltar (`clinica odontologica brusque`, `dentista azambuja`)
entram no grupo "Geral Brusque" da campanha ativa, em correspondência de frase.

### 1.3 Novas peças no Google (fase 2, depois do rastreio)
- **Performance Max local** com feed de serviços e meta de "contato": complemento, nunca substituto da Pesquisa. Só com 30+ conversões/mês medidas.
- **Remarketing** (observação) de visitantes do site e lista de pacientes (Customer Match) com lance +30%.
- **YouTube Shorts** com os Reels (6–15 s) só para público de remarketing, orçamento mínimo.

## 2. Meta Ads — conta 991888939034732 (a que funciona)

| Campanha | Objetivo | Resultado 2026 | Decisão | O que muda |
|---|---|---|---|---|
| **botox** (ativa, R$ 25/dia) | Leads (formulário) | 112 leads, **R$ 17,26/lead**, 70 mil impressões para 16 mil pessoas (frequência ≈ 4,3) | **MANTER** rodando como está; **não abrir campanha nova de harmonização** até o CRO-SC confirmar o efeito da decisão do TRF1 de 19/08/2026 (ver `02`, serviço 7) | Frequência alta = criativo cansado. Adicionar 2 criativos novos no mesmo conjunto; adicionar conjunto paralelo com objetivo **Mensagens → WhatsApp** (R$ 10/dia) para comparar qualidade do lead; perguntas de qualificação no formulário (já fez botox? quando quer fazer? bairro). Resposta em até 5 min via painel. |
| **ortodontia** (ativa, R$ 25/dia, "aprendizado limitado") | Leads (formulário) | 47 leads, **R$ 40,30/lead** (pior da conta), 128 mil impressões para 29 mil pessoas (freq. 4,4) | **ALTERAR** | Dividir em 2 conjuntos: **Alinhador invisível** (adultos 22–40, profissionais) e **Aparelho fixo** (pais 35–50 + jovens 16–24). Trocar para Mensagens. Reduzir para R$ 15/dia no teste. Meta: CPL < R$ 30 em 14 dias; se não, pausar e deixar ortodontia só no Google. |
| **Clareamento** (desativada) | Mensagens | 50 conversas, R$ 26,10 | **REATIVAR agora** (sazonal out–dez) | Criativo novo (noivas, formaturas, festas), oferta "clareamento personalizado com avaliação", R$ 12/dia. Juntar com **DENTES BRANCOS 1** (R$ 27,36) numa campanha só. |
| **Protese protocolo 2** (desativada) | Mensagens | 49 conversas, **R$ 19,42** | **REATIVAR** | Consolidar **Protese protocolo 2 + PROTOCOLO (R$ 20,51) + Protese Protoclo (R$ 33,77)** numa campanha "Prótese protocolo e implante", com o criativo do melhor resultado. R$ 15/dia. Ticket alto: qualificar no WhatsApp antes de agendar (quantos dentes faltam, usa prótese móvel, bairro). Público 45+. |
| **botox** (2ª, desativada) | Mensagens | 45 conversas, R$ 19,70 | **FUNDIR** | Vira o conjunto "Mensagens" dentro da campanha botox ativa. |
| **COMECE O ANO** (desativada) | Mensagens | 20 conversas, R$ 23,42 | **AGENDAR para 02/01/2027** | Rede de segurança de janeiro: avaliação + clareamento + "colocar o sorriso em dia". Planejar criativo em dezembro. |

**Lacunas a preencher na conta boa** (ninguém rodou em 2026): urgência, odontopediatria, lente de
contato, harmonização masculina, avaliação geral. Entram como campanhas novas de teste em
`03-PLANO-DE-TESTES.md`.

**Gastos hoje x proposto**

| | Hoje | Proposta mês 1 | Proposta mês 2+ |
|---|---|---|---|
| Google Pesquisa | R$ 65/dia | R$ 65/dia | R$ 90–100/dia |
| Meta botox | R$ 25/dia | R$ 25 + R$ 10 (Mensagens) | conforme CPL |
| Meta ortodontia | R$ 25/dia | R$ 15/dia (teste dividido) | pausar ou escalar |
| Meta clareamento (sazonal) | 0 | R$ 12/dia | até dez |
| Meta prótese/implante | 0 | R$ 15/dia | conforme CPA por fechamento |
| Meta testes novos (1 por vez) | 0 | R$ 30–40/dia | rotativo |
| **Total/dia** | **≈ R$ 115** | **≈ R$ 175** | **≈ R$ 200–230** |
| **Total/mês** | ≈ R$ 3.500 | ≈ R$ 5.300 | ≈ R$ 6.000–7.000 |

Os valores são sugestão; a Dra. decide o teto. O que não se negocia é manter os R$ 115/dia atuais
rodando enquanto as novas estruturas não provarem resultado.

## 3. Meta Ads — conta 638556319545340 (a dos posts impulsionados)

- 74 campanhas de "Impulsionar publicação": pausar todas, arquivar depois de 30 dias. Não apagar
  (histórico de aprendizado e provas de criativo).
- Anúncios "Rejeitado" (antes/depois, "Mais um sorriso novo", "Harmonia, delicadeza"): provável
  violação de política de saúde/estética (promessa de resultado, antes/depois sem contexto) ou
  Página/WhatsApp desconectados. Ler o motivo de cada um antes de reaproveitar o criativo.
- Decisão: **uma conta só** (991888939034732). Se a cliente quiser manter esta por histórico,
  deixar com R$ 0 e sem campanhas ativas.

## 4. Acessos, pagamento e rastreio (sem isso nada acima funciona)

1. Remover **Hugo Petyk** (hugopetyk@gmail.com) do Business Manager, Página, Instagram e conta de anúncios; a Dra. fica como administradora e o Salvador como parceiro/gestor.
2. **Verificar a empresa** no Business Manager (CNPJ, comprovante): libera o limite de 250 → 2.000 conversas/dia no WhatsApp e evita rejeições por conta nova.
3. Conferir **método de pagamento** da conta 991888939034732 (saldo R$ 650 em 03/10, cobrança diária).
4. **Site**: clinicaespecita.com.br não resolve. Até consertar, todo anúncio aponta para WhatsApp ou formulário nativo. Sem site não há Pixel; usar **API de Conversões via WhatsApp** (eventos de conversa iniciada) e, quando o site voltar, Pixel + CAPI.
5. **Perfil da Empresa no Google**: conferir que está reivindicado pela clínica (não pela agência), com categoria "Clínica odontológica", horários, WhatsApp e fotos.
6. **Página do Facebook** ainda se chama "Específica Odontologia & Estética": corrigir para Especitá antes de rodar anúncio novo (o nome aparece em todo anúncio).

## 5. Regra do CFO que vale para tudo acima
Anúncio de dentista não pode trazer preço, parcelamento, desconto, "grátis", promoção, garantia nem depoimento de paciente; antes/depois só com termo de consentimento e fora de anúncio pago. Condições de pagamento e avaliação sem custo ficam só na conversa do WhatsApp. Detalhe em `02-PUBLICOS-E-PERSONAS.md`.

## 6. Resumo para a Dra. (uma frase por linha)

- O botox é a melhor campanha da conta e continua rodando.
- Ortodontia está cara: vamos dividir em alinhador e aparelho fixo e testar 14 dias.
- Clareamento e prótese já deram resultado barato e foram desligadas: voltam agora.
- As 74 campanhas de post impulsionado estão quebradas: saem do caminho.
- Google continua, mas organizado por serviço e com o rastreio consertado.
- Primeiro passo de tudo: tirar o acesso da agência antiga e verificar a empresa na Meta.
- Harmonização: confirmar com o CRO-SC antes de qualquer anúncio novo (decisão judicial de agosto).
