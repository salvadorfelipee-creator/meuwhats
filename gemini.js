// Integração com a API gratuita do Google Gemini — usada só pra LER o contexto de uma conversa
// e SUGERIR etapa do pipeline + valores de campos personalizados. Nunca aplica nada sozinha: a
// pessoa sempre confirma com um clique no painel (ver POST .../sugestao-ia em server.js). Chave
// gratuita em https://aistudio.google.com/apikey — sem cartão, com cota diária generosa.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function montarPrompt({ mensagens, estagios, campos, valoresAtuais }) {
  const transcricao = mensagens
    .map((m) => {
      const quem = m.direction === "in" ? "Cliente" : "Atendimento";
      const corpo = m.body || `[${m.type || "mídia"}]`;
      return `${quem}: ${corpo}`;
    })
    .join("\n");

  const etapasTexto = estagios.map((e) => `- "${e.id}": ${e.nome}`).join("\n");

  const camposTexto = campos.length
    ? campos
        .map((c) => {
          const atual = valoresAtuais.find((v) => v.campo_id === c.id)?.valor;
          return `- "${c.nome}"${atual ? ` (valor atual: "${atual}")` : " (ainda vazio)"}`;
        })
        .join("\n")
    : "(nenhum campo personalizado cadastrado nesse negócio)";

  return `Você está ajudando a organizar o CRM de um atendimento por WhatsApp. Leia a conversa abaixo e responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois, exatamente neste formato:

{"etapa_id": "id_da_etapa_ou_null", "confianca": "alta|media|baixa", "campos": [{"nome": "nome_do_campo", "valor": "valor_sugerido"}], "resumo": "1-2 frases curtas explicando o porquê, em português"}

Etapas disponíveis (use exatamente um destes "id", ou null se a conversa não dá pra saber):
${etapasTexto}

Campos personalizados disponíveis (só sugira valor pros que você tem evidência clara no texto da conversa — não invente, não repita um valor que já está igual ao atual):
${camposTexto}

Conversa (mais antiga primeiro):
${transcricao}`;
}

async function sugerirPipeline({ mensagens, estagios, campos, valoresAtuais }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY não configurada");
    err.code = "SEM_CHAVE";
    throw err;
  }
  if (!estagios.length) {
    const err = new Error("Nenhuma etapa de pipeline informada");
    err.code = "SEM_ETAPAS";
    throw err;
  }

  const prompt = montarPrompt({ mensagens, estagios, campos, valoresAtuais });

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    },
  );

  if (!resp.ok) {
    const texto = await resp.text().catch(() => "");
    const err = new Error(`Gemini respondeu ${resp.status}: ${texto.slice(0, 300)}`);
    err.code = "ERRO_API";
    throw err;
  }

  const data = await resp.json();
  const textoResposta = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textoResposta) {
    const err = new Error("Gemini não retornou texto (resposta pode ter sido bloqueada por segurança)");
    err.code = "SEM_RESPOSTA";
    throw err;
  }

  let json;
  try {
    json = JSON.parse(textoResposta);
  } catch {
    const err = new Error("Gemini retornou um JSON inválido");
    err.code = "JSON_INVALIDO";
    throw err;
  }

  // Validação defensiva: só aceita etapa_id que existe de verdade na lista enviada, e só aceita
  // campos que existem de verdade no CRM desse negócio — nunca confia cegamente no texto que a
  // IA devolveu.
  const idsValidos = new Set(estagios.map((e) => e.id));
  const etapaId = idsValidos.has(json.etapa_id) ? json.etapa_id : null;

  const porNome = new Map(campos.map((c) => [c.nome.trim().toLowerCase(), c]));
  const camposSugeridos = Array.isArray(json.campos)
    ? json.campos
        .filter((c) => c && typeof c.nome === "string" && typeof c.valor === "string" && c.valor.trim())
        .map((c) => {
          const campo = porNome.get(c.nome.trim().toLowerCase());
          return campo ? { campo_id: campo.id, nome: campo.nome, valor: c.valor.trim() } : null;
        })
        .filter(Boolean)
    : [];

  return {
    etapa_id: etapaId,
    confianca: ["alta", "media", "baixa"].includes(json.confianca) ? json.confianca : "baixa",
    campos: camposSugeridos,
    resumo: typeof json.resumo === "string" ? json.resumo.slice(0, 500) : "",
  };
}

module.exports = { sugerirPipeline };
