(() => {
  "use strict";
  const API = "https://meuwhats.onrender.com/site-chat/proposal/";
  const stages = [
    { key: "authorization", title: "Autorização", text: "Permissão para consultar vínculo e margem." },
    { key: "conditions", title: "Condições disponíveis", text: "Consulta e apresentação das opções encontradas." },
    { key: "proposal", title: "Dados da proposta", text: "Conferência dos dados antes da contratação." },
    { key: "signature", title: "Assinatura", text: "Revisão e assinatura segura do contrato." },
    { key: "analysis", title: "Análise da instituição", text: "Validação final das informações e do contrato." },
    { key: "payment", title: "Conclusão", text: "Resultado final e confirmação do pagamento." },
  ];
  const stateMap = {
    inicio: [0,"Preparando sua solicitação","Vamos organizar os primeiros dados para começar.","Abra o chat para iniciar sua simulação."],
    solicitando_autorizacao: [0,"Solicitando autorização","A Facta está preparando sua autorização.","Aguarde a mensagem de autorização no WhatsApp."],
    autorizacao_enviada: [0,"Autorização enviada","Falta concluir a autorização enviada pela Facta.","Abra a mensagem recebida no WhatsApp e confirme a autorização."],
    aguardando_autorizacao: [0,"Aguardando autorização","A consulta começa assim que você autorizar.","Conclua a autorização enviada para o seu WhatsApp."],
    consultando_margem: [1,"Consultando condições","Estamos verificando vínculo e margem disponíveis.","Nenhuma ação é necessária agora. Esta página será atualizada automaticamente."],
    pre_qualificado: [1,"Condições encontradas","Há condições disponíveis para você analisar.","Continue no chat para comparar as opções com calma."],
    ofertas_disponiveis: [1,"Escolha uma condição","Suas opções estão prontas para comparação.","Continue no chat para escolher a condição desejada."],
    dados_pessoais: [2,"Complete seus dados","Precisamos das informações finais para montar a proposta.","Continue no chat e revise os dados antes de enviar."],
    aguardando_assinatura_facta: [3,"Proposta pronta para assinatura","Revise todas as condições antes de assinar.","Use o botão abaixo para abrir a assinatura segura."],
    proposta_em_analise: [4,"Proposta em análise","A assinatura foi recebida e a instituição está fazendo a análise final.","Você não precisa preencher nada novamente. Acompanhe por esta página."],
    proposta_concluida: [5,"Pagamento concluído","A instituição confirmou a conclusão da proposta.","Confira a conta informada na contratação. Se precisar, fale com a FelizCred."],
    proposta_cancelada: [5,"Proposta não concluída","A instituição encerrou esta proposta.","Para entender o motivo ou verificar alternativas, fale com a FelizCred."],
    nao_elegivel: [5,"Consulta concluída","Neste momento não foi possível seguir com a proposta.","Se quiser entender o resultado, fale com a FelizCred."],
    sem_margem: [5,"Sem margem disponível","A consulta não encontrou margem disponível neste momento.","Você pode falar com a FelizCred se precisar de orientação."],
    sem_oferta: [5,"Sem condição disponível","A consulta terminou sem uma oferta disponível neste momento.","Fale com a FelizCred se quiser verificar outras possibilidades."],
    politica_reprovada: [5,"Proposta não aprovada","A condição não passou pela política de crédito da instituição.","Para esclarecer dúvidas, fale com a FelizCred."],
  };
  const $ = (s) => document.querySelector(s);
  const token = new URLSearchParams(location.search).get("token") || "";
  function render(data) {
    const p = data.proposal, info = stateMap[p.stage] || [1,"Em acompanhamento","Estamos consultando a atualização mais recente.","Nenhuma ação é necessária agora."];
    $("#customerName").textContent = p.customerName || "cliente";
    $("#headline").textContent = info[2]; $("#statusLabel").textContent = info[1];
    $("#nextTitle").textContent = info[1]; $("#nextText").textContent = info[3];
    $("#proposalCode").textContent = p.proposalCode ? `Proposta ${p.proposalCode} · ${p.provider}` : p.provider;
    $("#updatedAt").textContent = p.updatedAt ? `Atualizado em ${new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(Number(p.updatedAt)))}` : "Atualizado agora";
    $("#timeline").innerHTML = stages.map((s,i) => `<li class="step ${i<info[0]?"complete":i===info[0]?"current":"upcoming"}"><span class="step-marker">${i<info[0]?"✓":i+1}</span><div><h3>${s.title}</h3><p>${s.text}</p></div></li>`).join("");
    const action = $("#primaryAction");
    if (p.contractLink) { action.href=p.contractLink; action.textContent="Revisar e assinar proposta"; action.hidden=false; }
    else if (["pre_qualificado","ofertas_disponiveis","dados_pessoais"].includes(p.stage)) { action.href=p.supportUrl; action.textContent="Continuar minha proposta"; action.hidden=false; }
    $("#supportAction").href=p.supportUrl;
    $("#loading").hidden=true; $("#proposal").hidden=false;
  }
  async function load() {
    if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return fail("O endereço de acompanhamento está incompleto.");
    try { const r=await fetch(API+encodeURIComponent(token)); const j=await r.json(); if(!r.ok) throw new Error(j.error||"Não foi possível consultar a proposta."); render(j); }
    catch(e){ fail(e.message); }
  }
  function fail(message){ $("#loading").hidden=true; $("#errorText").textContent=message; $("#error").hidden=false; }
  load(); setInterval(()=>{ if(!document.hidden && !$("#proposal").hidden) load(); },30000);
})();
