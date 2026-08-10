const instagram = require("./instagram");
const facebook = require("./facebook");
const twitter = require("./twitter");
const linkedin = require("./linkedin");

// ─── Contas ─────────────────────────────────────────────────────────────────
// Cada conta agrupa as credenciais das redes ligadas a ela. Pra adicionar uma conta nova
// (outra marca/CNPJ, ex.: Cota Certa Seguros): copiar o bloco "felizcred" abaixo, trocar o
// `id`/`nome` e o sufixo das variáveis de ambiente (ex. INSTAGRAM_COTACERTA_ACCESS_TOKEN em
// vez de INSTAGRAM_ACCESS_TOKEN). Nenhum outro arquivo precisa mudar — ver PUBLIQUE-IV.md.
// Uma rede fica "desligada" sozinha enquanto a env var dela não existir (fica null abaixo).
const CONTAS = [
  {
    id: "felizcred",
    nome: "Felizcred",
    redes: {
      instagram:
        process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID
          ? { accessToken: process.env.INSTAGRAM_ACCESS_TOKEN, accountId: process.env.INSTAGRAM_ACCOUNT_ID }
          : null,
      facebook:
        process.env.FACEBOOK_PAGE_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID
          ? { token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN, paginaId: process.env.FACEBOOK_PAGE_ID }
          : null,
      twitter:
        process.env.TWITTER_API_KEY &&
        process.env.TWITTER_API_SECRET &&
        process.env.TWITTER_ACCESS_TOKEN &&
        process.env.TWITTER_ACCESS_SECRET
          ? {
              apiKey: process.env.TWITTER_API_KEY,
              apiSecret: process.env.TWITTER_API_SECRET,
              accessToken: process.env.TWITTER_ACCESS_TOKEN,
              accessSecret: process.env.TWITTER_ACCESS_SECRET,
            }
          : null,
      linkedin:
        process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN
          ? { token: process.env.LINKEDIN_ACCESS_TOKEN, autorUrn: process.env.LINKEDIN_AUTHOR_URN }
          : null,
    },
  },
  // Próxima conta entra aqui como um novo objeto igual ao de cima.
];

function contaPorId(contaId) {
  const conta = CONTAS.find((c) => c.id === contaId);
  if (!conta) throw new Error(`Conta desconhecida: ${contaId}`);
  return conta;
}

// Lista contas e, pra cada uma, quais redes já têm credencial configurada (usado pelo painel
// pra desenhar os checkboxes só com o que dá pra publicar de verdade).
function listarContas() {
  return CONTAS.map((c) => ({
    id: c.id,
    nome: c.nome,
    redesDisponiveis: Object.keys(c.redes).filter((rede) => c.redes[rede]),
  }));
}

// Cada adaptador recebe o mesmo conteúdo genérico { texto, imagemUrl, link } e usa só o que
// a rede aceita — ex.: Instagram exige imagem, LinkedIn ignora imagem e usa o link pra gerar
// a prévia. Ver PUBLIQUE-IV.md pra tabela completa de compatibilidade.
const ADAPTADORES = {
  instagram: (conteudo, credenciais) => {
    if (!conteudo.imagemUrl) throw new Error("Instagram exige uma imagem.");
    return instagram.publicarImagem({
      imagemUrl: conteudo.imagemUrl,
      legenda: conteudo.texto,
      accessToken: credenciais.accessToken,
      accountId: credenciais.accountId,
    });
  },
  facebook: (conteudo, credenciais) => facebook.publicar(conteudo, credenciais),
  twitter: (conteudo, credenciais) => twitter.publicar(conteudo, credenciais),
  linkedin: (conteudo, credenciais) => linkedin.publicar(conteudo, credenciais),
};

// Publica o mesmo conteúdo em várias redes de uma vez (um clique). Cada rede publica
// independente das outras — se uma falhar (token vencido, rede sem credencial etc.) as
// demais continuam, e o motivo de cada falha vai no resultado.
async function publicarEmTodos({ contaId = "felizcred", texto, imagemUrl, link, redes }) {
  const conta = contaPorId(contaId);
  const alvo = redes && redes.length ? redes : Object.keys(conta.redes);
  const conteudo = { texto, imagemUrl, link };
  const resultados = {};

  for (const rede of alvo) {
    if (!ADAPTADORES[rede]) {
      resultados[rede] = { ok: false, erro: "Rede desconhecida." };
      continue;
    }
    const credenciais = conta.redes[rede];
    if (!credenciais) {
      resultados[rede] = { ok: false, erro: "Sem credenciais configuradas para esta rede." };
      continue;
    }
    try {
      const resultado = await ADAPTADORES[rede](conteudo, credenciais);
      resultados[rede] = { ok: true, ...resultado };
    } catch (err) {
      resultados[rede] = { ok: false, erro: err.message };
    }
  }
  return resultados;
}

module.exports = { publicarEmTodos, listarContas };
