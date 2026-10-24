"use strict";

// Unnotech como 2º banco do consignado CLT no painel/chat do site. Usa a mesma linha de `site_chat_clt` da Facta:
// provider = "unnotech", e os campos abaixo guardam o que a Unnotech devolve (nomes herdados da Facta, de propósito,
// para não precisar de migração):
//   transaction_id  → application_id          terms_link   → consent_url (link único de autorização)
//   offers_json     → offers[] cru            facta_offer_json → oferta escolhida
//   codigo_proposta → proposal_uuid           contract_link → signature_link
//   status_novosaque → status da Unnotech     margem_disponivel → margem do vínculo usado
//   facta_worker_json → { employment_id, employer_name, anterior, tentativas[] }
// Etapas reaproveitam as do painel: autorizacao_enviada, consultando_margem, simulando, ofertas_disponiveis,
// dados_pessoais, aguardando_assinatura_facta, proposta_em_analise, proposta_concluida, proposta_cancelada,
// sem_margem, nao_elegivel, sem_oferta, erro_consulta.
const crypto = require("crypto");

const PRAZO_AUTORIZACAO_MS = 72 * 3600_000;
const PRAZO_ETAPA_MS = 45 * 60_000;
const ETAPAS_EM_ANDAMENTO = ["autorizacao_enviada", "aguardando_autorizacao", "consultando_margem", "simulando"];
const ETAPAS_ACOMPANHAMENTO = ["aguardando_assinatura_facta", "proposta_em_analise"];

function configurado() {
  return !!(process.env.UNNOTECH_CLIENT_ID && process.env.UNNOTECH_CLIENT_SECRET);
}

function lerBlob(row) {
  try { return JSON.parse(row.facta_worker_json || "{}") || {}; } catch { return {}; }
}
function lerOfertas(row) {
  try { return JSON.parse(row.offers_json || "[]") || []; } catch { return []; }
}
function dataIso(valor) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(valor || ""));
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || "")) ? valor : undefined;
}

// Ofertas que ainda valem (disponíveis e dentro do prazo).
function ofertasValidas(offers) {
  const agora = Date.now();
  return (offers || []).filter((o) => o.status === "AVAILABLE" && (!o.expires_at || new Date(o.expires_at).getTime() > agora));
}

// Comissão da Unnotech (tela "Comissão Unificada" de 23/10/2026): % sobre o valor líquido por tabela, com ou sem seguro,
// e faixa de prazo. A lista veio ordenada da maior para a menor e foi cortada em 2,4%: o que não está aqui vale 0 (fica
// por último). Atualizar quando a Unnotech mudar a comissão.
const COMISSAO_UNNO = [
  ["BUZIOS", true, 25, 36, 9.6], ["BUZIOS", true, 19, 24, 7.2], ["ITAPEMA", true, 46, 46, 6.4], ["JURERE", true, 48, 48, 5.2],
  ["BUZIOS", true, 16, 18, 5.2], ["ITAPEMA", true, 36, 36, 5.1], ["COPACABANA", true, 36, 36, 4.4], ["ITAPEMA", true, 24, 24, 4.25],
  ["JURERE", true, 42, 42, 4.2], ["BUZIOS", true, 15, 15, 4.0], ["BUZIOS", false, 25, 36, 3.6], ["JURERE", true, 36, 36, 3.6],
  ["CAMPECHE", true, 36, 36, 3.6], ["BUZIOS", false, 19, 24, 3.2], ["BUZIOS", false, 16, 18, 2.8], ["COPACABANA", false, 36, 36, 2.8],
  ["COPACABANA", true, 24, 35, 2.8], ["JURERE", true, 30, 30, 2.6], ["BUZIOS", false, 15, 15, 2.4],
];

function semAcento(texto) {
  return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function comissaoOferta(o) {
  const nome = semAcento(o.table_name);
  const prazo = Number(o.installment_count);
  const comSeguro = o.insurance_included === true || /COM SEGURO/.test(nome);
  const regra = COMISSAO_UNNO.find(([tabela, seguro, de, ate]) => nome.includes(tabela) && seguro === comSeguro && prazo >= de && prazo <= ate);
  return regra ? regra[4] : 0;
}

// Mesma regra de apresentação da Facta: em cada prazo vale a tabela de MAIOR COMISSÃO (empate = mais dinheiro na mão);
// mostra o maior prazo e o de 24x (sem 24x, o menor prazo); um prazo só = uma opção.
function comSeguro(o) {
  return o.insurance_included === true || Number(o.insurance_amount) > 0;
}

function selecionarOfertas(offers) {
  let validas = ofertasValidas(offers);
  // Regra do dono: nenhuma oferta com seguro, a não ser que não exista outra. O que sobrar aparece mesmo com comissão menor.
  const semSeguro = validas.filter((o) => !comSeguro(o));
  if (semSeguro.length) validas = semSeguro;
  const melhor = (prazo) => validas
    .filter((o) => Number(o.installment_count) === prazo)
    .sort((a, b) => comissaoOferta(b) - comissaoOferta(a) || Number(b.net_amount) - Number(a.net_amount) || Number(a.installment_amount) - Number(b.installment_amount))[0];
  const prazos = [...new Set(validas.map((o) => Number(o.installment_count)))].sort((a, b) => a - b);
  if (!prazos.length) return [];
  const maior = prazos[prazos.length - 1];
  const segundo = prazos.includes(24) ? 24 : prazos[0];
  return [...new Set([maior, segundo])].map(melhor).filter(Boolean);
}

// Formato público (o mesmo que o painel já entende da Facta).
function ofertaPublica(o) {
  return {
    id: String(o.offer_id),
    tableName: o.table_name,
    installments: Number(o.installment_count || 0),
    installmentValue: Number(o.installment_amount || 0),
    disbursedAmount: Number(o.net_amount || 0),
    contractValue: Number(o.gross_amount || o.net_amount || 0),
    rate: Number(o.monthly_interest_rate || 0),
    insuranceValue: Number(o.insurance_amount || 0),
  };
}

function criarAdaptador({ db, unnotech, mensagemAtendente, notificar = async () => {} }) {
  const falar = async (row, texto) => {
    try { await mensagemAtendente(row.conversation_id, texto); } catch (err) { console.error("Mensagem do assistente (Unnotech) não gravada:", err.message); }
  };
  const atualizar = (row, campos) => db.siteChatCltAtualizar(row.conversation_id, campos);

  // Abre a solicitação na Unnotech com os dados que o cliente já informou (CPF, celular, e-mail, nome). Devolve a linha
  // atualizada, ou null se não foi possível (sem credencial, dado faltando ou erro da API: a Facta continua como estava).
  async function iniciar(row, conversa, anterior) {
    if (!configurado()) return null;
    const email = String(conversa?.email || "").trim();
    const phone = String(row.phone || conversa?.contact || "").replace(/\D/g, "");
    if (!row.cpf || !email || phone.length < 10) return null;
    let worker = {};
    try { worker = JSON.parse(row.facta_worker_json || "{}") || {}; } catch {}
    let app;
    try {
      app = await unnotech.criarSolicitacaoClt(row.cpf, phone, email, crypto.randomUUID(), {
        name: worker.nome || worker.preAuthorization?.nome || conversa?.name || undefined,
        birthDate: dataIso(worker.dataNascimento),
      });
    } catch (err) {
      console.error(`Unnotech: não abriu a solicitação (${row.conversation_id}):`, err.message);
      return null;
    }
    const novo = await atualizar(row, {
      provider: "unnotech",
      transaction_id: app.application_id,
      etapa: "autorizacao_enviada",
      status_novosaque: app.status || "AWAITING_AUTHORIZATION",
      terms_link: app.authorization?.consent_url || null,
      facta_worker_json: JSON.stringify({ anterior: anterior || null, tentativas: [] }),
      offers_json: "[]",
      facta_offer_json: null,
      contract_link: null,
      codigo_proposta: null,
      authorization_requested_at: Date.now(),
      authorization_checked_at: null,
      error_message: null,
    });
    await falar(row, "A Facta não liberou condições, mas vamos tentar com outros bancos parceiros usando os mesmos dados. Falta só você autorizar a consulta pelo botão que aparece na tela.");
    return novo;
  }

  async function encerrar(row, etapa, erro) {
    return atualizar(row, { etapa, error_message: erro || null });
  }

  // Avança a solicitação (autorização → margem → simulação → ofertas). Chamada a cada consulta de status do painel.
  async function avancar(row) {
    const blob = lerBlob(row);
    const status = await unnotech.consultarStatusClt(row.transaction_id);
    const desde = Number(row.authorization_requested_at || row.created_at || Date.now());
    if (!row.terms_link) {
      const completa = await unnotech.consultarSolicitacaoCompletaClt(row.transaction_id).catch(() => null);
      const url = completa?.authorization?.consent_url;
      if (url) row = await atualizar(row, { terms_link: url });
    }
    if (status.status === "NO_MARGIN") return encerrar(row, "sem_margem", "Nenhum vínculo seu tem margem disponível nos bancos parceiros agora.");
    if (status.authorization_status === "NOT_AVAILABLE") return encerrar(row, "nao_elegivel", "Seu CPF ainda não liberou a consulta no Dataprev (Carteira de Trabalho Digital). Depois que liberar, é só falar com a gente.");
    if (["EXPIRED", "CANCELLED", "FAILED"].includes(status.status)) return encerrar(row, "erro_consulta", "A consulta nos bancos parceiros não foi concluída. Um atendente pode ajudar.");
    if (status.status === "NO_OFFERS") return encerrar(row, "sem_oferta", "Os bancos parceiros não encontraram uma condição agora.");

    if (status.authorization_status === "AUTHORIZED" && row.etapa === "autorizacao_enviada") row = await atualizar(row, { etapa: "consultando_margem", status_novosaque: status.status, authorization_requested_at: Date.now() }); // reinicia o relógio da etapa

    if (status.status === "AWAITING_SIMULATION" && ["consultando_margem", "autorizacao_enviada"].includes(row.etapa)) {
      const margem = await unnotech.consultarMargemClt(row.transaction_id);
      const vinculos = [...(margem.employments || [])].sort((a, b) => Number(b.available_margin || 0) - Number(a.available_margin || 0));
      const vinculo = vinculos[0];
      if (!vinculo || Number(vinculo.available_margin || 0) <= 0) return encerrar(row, "sem_margem", "Nenhum vínculo seu tem margem disponível nos bancos parceiros agora.");
      await unnotech.simularClt(row.transaction_id, { employmentId: vinculo.employment_id, basis: "INSTALLMENT", valor: Number(vinculo.available_margin) }, crypto.randomUUID());
      return atualizar(row, {
        etapa: "simulando",
        margem_disponivel: Number(vinculo.available_margin),
        status_novosaque: status.status,
        authorization_requested_at: Date.now(),
        facta_worker_json: JSON.stringify({ ...blob, employment_id: vinculo.employment_id, employer_name: vinculo.employer_name || null }),
      });
    }

    if (status.status === "OFFERS_AVAILABLE" && Number(status.quotes_pending || 0) === 0 && ["simulando", "consultando_margem", "autorizacao_enviada"].includes(row.etapa)) {
      const completa = await unnotech.consultarSolicitacaoCompletaClt(row.transaction_id);
      if (!ofertasValidas(completa.offers).length) return encerrar(row, "sem_oferta", "Os bancos parceiros não aprovaram uma condição agora.");
      await db.siteChatFunilEvento(row.conversation_id, "oferta_disponivel", "ofertas_disponiveis", "unnotech").catch(() => {});
      await db.siteChatDefinirPipeline(row.conversation_id, "proposta").catch(() => {});
      await falar(row, "Encontramos condições com bancos parceiros. Os valores ainda passam pela análise final do banco.");
      return atualizar(row, { etapa: "ofertas_disponiveis", offers_json: JSON.stringify(completa.offers || []), status_novosaque: status.status, error_message: null });
    }

    const limite = row.etapa === "autorizacao_enviada" ? PRAZO_AUTORIZACAO_MS : PRAZO_ETAPA_MS;
    if (Date.now() - desde > limite) {
      return encerrar(row, "erro_consulta", "A consulta nos bancos parceiros demorou mais que o esperado. Um atendente pode ajudar.");
    }
    return atualizar(row, { status_novosaque: status.status });
  }

  // Depois do aceite: acompanha até o pagamento. Recusa do banco tenta a próxima oferta do mesmo menu.
  async function acompanhar(row) {
    const blob = lerBlob(row);
    const status = await unnotech.consultarStatusClt(row.transaction_id);
    if (status.status === "CONTRACT_REJECTED") {
      const tentativas = blob.tentativas || [];
      try { const escolhida = JSON.parse(row.facta_offer_json || "null"); if (escolhida && !tentativas.includes(escolhida.offer_id)) tentativas.push(escolhida.offer_id); } catch {}
      const completa = await unnotech.consultarSolicitacaoCompletaClt(row.transaction_id);
      const proxima = unnotech.escolherMelhorOferta(completa.offers, tentativas);
      if (!proxima) return encerrar(row, "proposta_cancelada", "Os bancos parceiros não aprovaram a contratação. Nossa equipe já recebeu a atualização.");
      await unnotech.aceitarOfertaClt(row.transaction_id, proxima.offer_id, crypto.randomUUID());
      return atualizar(row, { facta_offer_json: JSON.stringify(proxima), facta_worker_json: JSON.stringify({ ...blob, tentativas }), codigo_proposta: null, contract_link: null, status_novosaque: status.status });
    }
    const campos = { status_novosaque: status.status };
    if (status.proposal_uuid) {
      campos.codigo_proposta = String(status.proposal_uuid);
      if (!row.contract_link || row.codigo_proposta !== String(status.proposal_uuid)) {
        const proposta = await unnotech.consultarProposta(status.proposal_uuid).catch(() => null);
        if (proposta?.signature_link) campos.contract_link = proposta.signature_link;
      }
    }
    if (status.status === "DISBURSED") campos.etapa = "proposta_concluida";
    else if (["SIGNED", "ENDORSED"].includes(status.status)) campos.etapa = "proposta_em_analise";
    else if (["FAILED", "REJECTED", "CANCELLED"].includes(status.status)) { campos.etapa = "proposta_cancelada"; campos.error_message = "O contrato não foi finalizado. Nossa equipe já recebeu a atualização."; }
    const novo = await atualizar(row, campos);
    // Avisos por WhatsApp e e-mail: contrato pronto para assinar (1 vez) e mudanças de etapa.
    if (campos.contract_link && !row.contract_link) notificar(novo, "aguardando_assinatura_facta").catch(() => {});
    if (campos.etapa && campos.etapa !== row.etapa) notificar(novo, campos.etapa).catch(() => {});
    if (campos.etapa && campos.etapa !== row.etapa) {
      if (campos.etapa === "proposta_em_analise") await falar(row, "Sua assinatura foi recebida. Agora o banco confirma a averbação e o pagamento; acompanhe por aqui.");
      if (campos.etapa === "proposta_concluida") await falar(row, "O banco confirmou o pagamento. Confira a conta informada na contratação.");
      if (campos.etapa === "proposta_cancelada") await falar(row, "Seu contrato não foi finalizado. Nossa equipe já recebeu a atualização; aguarde o atendimento.");
    }
    return novo;
  }

  async function sincronizar(row) {
    if (!row || row.provider !== "unnotech" || !row.transaction_id) return row;
    const emAndamento = ETAPAS_EM_ANDAMENTO.includes(row.etapa);
    const acompanhando = ETAPAS_ACOMPANHAMENTO.includes(row.etapa);
    if (!emAndamento && !acompanhando) return row;
    if (row.authorization_checked_at && Date.now() - Number(row.authorization_checked_at) < 8_000) return row;
    await atualizar(row, { authorization_checked_at: Date.now() });
    return emAndamento ? avancar(row) : acompanhar(row);
  }

  function escolherOferta(row, offerId) {
    const oferta = lerOfertas(row).find((o) => String(o.offer_id) === String(offerId));
    if (!oferta || row.etapa !== "ofertas_disponiveis" || !ofertasValidas([oferta]).length) return null;
    return atualizar(row, { facta_offer_json: JSON.stringify(oferta), etapa: "dados_pessoais", error_message: null });
  }

  const OBRIGATORIOS = ["nome", "data_nascimento", "genero", "estado_civil", "escolaridade", "nome_mae", "rg_numero", "rg_orgao", "rg_uf", "cep", "rua", "numero", "bairro", "cidade", "uf", "forma_desembolso"];
  const OBRIGATORIOS_CONTA = ["banco", "tipo_conta", "agencia", "conta", "digito_conta"];

  // KYC completo + aceite da oferta escolhida.
  async function enviarDados(row, dados) {
    if (row.etapa !== "dados_pessoais") throw new Error("Escolha uma condição antes de enviar seus dados.");
    const faltando = [...OBRIGATORIOS, ...(dados.forma_desembolso === "CONTA" ? OBRIGATORIOS_CONTA : [])].filter((c) => !String(dados[c] || "").trim());
    if (faltando.length) throw new Error("Preencha todos os campos obrigatórios para gerar a proposta.");
    let oferta;
    try { oferta = JSON.parse(row.facta_offer_json || "null"); } catch {}
    if (!oferta) throw new Error("Escolha uma condição antes de enviar seus dados.");
    await unnotech.enviarKycClt(row.transaction_id, unnotech.montarPayloadKycClt(row.cpf, dados));
    try {
      await unnotech.aceitarOfertaClt(row.transaction_id, oferta.offer_id, crypto.randomUUID());
    } catch (err) {
      if (err.codigo === "OFFER_EXPIRED" || /OFFER_EXPIRED/.test(err.message || "")) {
        // O menu venceu: simula de novo no mesmo valor e volta para a escolha.
        const blob = lerBlob(row);
        await unnotech.simularClt(row.transaction_id, { employmentId: blob.employment_id, basis: "INSTALLMENT", valor: Number(row.margem_disponivel) }, crypto.randomUUID());
        await atualizar(row, { etapa: "simulando", facta_offer_json: null, error_message: "As condições venceram; estamos atualizando. Escolha de novo em instantes." });
        throw new Error("As condições venceram. Estamos atualizando os valores; escolha de novo em instantes.");
      }
      throw err;
    }
    return atualizar(row, { etapa: "aguardando_assinatura_facta", status_novosaque: "CONTRACTING", codigo_proposta: null, contract_link: null, error_message: null });
  }

  // "Quero pagar menos": simula de novo com a parcela digitada (até a margem).
  async function resimular(row, valor) {
    const blob = lerBlob(row);
    if (row.etapa !== "ofertas_disponiveis") throw new Error("Essa simulação não está disponível agora.");
    await unnotech.simularClt(row.transaction_id, { employmentId: blob.employment_id, basis: "INSTALLMENT", valor }, crypto.randomUUID());
    return atualizar(row, { etapa: "simulando", offers_json: "[]", error_message: null });
  }

  return { configurado, iniciar, sincronizar, escolherOferta, enviarDados, resimular, selecionarOfertas, ofertaPublica, lerBlob, lerOfertas };
}

module.exports = { criarAdaptador, configurado, selecionarOfertas, ofertaPublica, ofertasValidas, comissaoOferta };
