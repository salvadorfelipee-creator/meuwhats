const assert = require("node:assert/strict");
const rules = require("../site-chat-rules");

assert.equal(rules.mensagensSemelhantes("Sim", "sim"), true);
assert.equal(rules.mensagensSemelhantes("Nao estou achando botao", "Nao esta aparecendo botão avançar"), true);
assert.equal(rules.mensagensSemelhantes("Quero FGTS", "Qual a taxa do empréstimo?"), false);

assert.equal(rules.solicitacaoRepetida("Não aparece o botão", [
  { direction: "visitor", body: "Não estou achando botão" },
  { direction: "agent", body: "Procure na parte de baixo" },
  { direction: "visitor", body: "Não aparece o botão" },
]), true);

assert.equal(rules.solicitacaoRepetida("Quero simular", [
  { direction: "visitor", body: "Tenho interesse em FGTS" },
  { direction: "visitor", body: "Quero simular" },
]), false);

const dentroDoHorario = new Date("2026-10-20T13:00:00.000Z"); // terça, 10h em São Paulo
const foraDoHorario = new Date("2026-10-20T23:00:00.000Z"); // terça, 20h em São Paulo
assert.equal(rules.horarioComercial(dentroDoHorario), true);
assert.equal(rules.horarioComercial(foraDoHorario), false);
assert.match(rules.encaminhamentoWhatsAppPorRepeticao(dentroDoHorario), /continue agora/i);
assert.match(rules.encaminhamentoWhatsAppPorRepeticao(foraDoHorario), /próximo dia útil/i);
assert.match(rules.encaminhamentoWhatsAppPorRepeticao(foraDoHorario), /wa\.me\/554797059353/i);

console.log("site-chat-repeat-rules: ok");
