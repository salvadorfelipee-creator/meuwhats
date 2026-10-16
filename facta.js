"use strict";

function config() {
  const baseUrl = String(process.env.FACTA_BRIDGE_URL || "").replace(/\/$/, "");
  const secret = process.env.FACTA_BRIDGE_SECRET || "";
  if (!baseUrl || !secret) throw new Error("FACTA_BRIDGE_URL/FACTA_BRIDGE_SECRET não configurados");
  return { baseUrl, secret };
}

async function request(target, method, path, { query, body } = {}) {
  const { baseUrl, secret } = config();
  const response = await fetch(`${baseUrl}/v1/facta/request`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target, method, path, query, body }),
    signal: AbortSignal.timeout(35_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.message || `Falha na ponte Facta (${response.status})`);
    error.httpStatus = payload?.upstreamStatus || payload?.status || response.status;
    error.factaResponse = payload?.upstream || payload?.body || payload;
    throw error;
  }
  return payload.body;
}

function solicitarAutorizacao({ nome, cpf, celular, tipoEnvio = "WHATSAPP", matricula }) {
  return request("online", "POST", "/solicita-autorizacao-consulta", {
    body: { averbador: "10010", nome, cpf, celular, tipo_envio: tipoEnvio, matricula },
  });
}

function consultarTrabalhador(cpf) {
  return request("online", "GET", "/consignado-trabalhador/autoriza-consulta", { query: { cpf } });
}

function consultarBaseOffline(cpf) {
  return request("offline", "GET", "/clt/base-offline", { query: { cpf } });
}

function consultarOfertas(cpf) {
  return request("online", "GET", "/consignado-trabalhador/consulta-ofertas", { query: { cpf } });
}

function analisarPolitica(dados) {
  return request("online", "GET", "/consignado-trabalhador/analise-politica-credito", { query: dados });
}

function consultarOperacoes(dados) {
  return request("online", "GET", "/proposta/operacoes-disponiveis", {
    query: { produto: "D", tipo_operacao: 13, averbador: 10010, convenio: 3, ...dados },
  });
}

function criarSimulacao(dados) {
  return request("online", "POST", "/proposta/etapa1-simulador", {
    body: { produto: "D", tipo_operacao: 13, averbador: 10010, convenio: 3, ...dados },
  });
}

function cadastrarDadosPessoais(dados) {
  return request("online", "POST", "/proposta/etapa2-dados-pessoais", { body: dados });
}

function criarProposta(dados) {
  return request("online", "POST", "/proposta/etapa3-proposta-cadastro", { body: dados });
}

function enviarLinkAssinatura(codigoAf, tipoEnvio = "whatsapp") {
  return request("online", "POST", "/proposta/envio-link", {
    body: { codigo_af: codigoAf, tipo_envio: tipoEnvio },
  });
}

function consultarAndamentoProposta(codigoAf) {
  return request("online", "GET", "/proposta/andamento-propostas", {
    query: { af: codigoAf, convenio: 3, averbador: 10010, quantidade: 1 },
  });
}

function consultarOcorrenciasProposta(codigoAf) {
  return request("online", "GET", "/proposta/consulta-ocorrencias", { query: { af: codigoAf } });
}

function consultarCombo(nome, query) {
  return request("online", "GET", `/proposta-combos/${nome}`, { query });
}

module.exports = {
  request,
  solicitarAutorizacao,
  consultarTrabalhador,
  consultarBaseOffline,
  consultarOfertas,
  analisarPolitica,
  consultarOperacoes,
  criarSimulacao,
  cadastrarDadosPessoais,
  criarProposta,
  enviarLinkAssinatura,
  consultarAndamentoProposta,
  consultarOcorrenciasProposta,
  consultarCombo,
};
