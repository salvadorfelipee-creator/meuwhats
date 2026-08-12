const instagram = require("./instagram");
const facebook = require("./facebook");
const twitter = require("./twitter");
const linkedin = require("./linkedin");
const threads = require("./threads");

// Variáveis de ambiente de credencial vêm sempre com trim() — copiar/colar token no painel
// do Render facilmente carrega um espaço ou quebra de linha a mais no fim, e isso quebra o
// header Authorization de um jeito confuso ("Invalid character in header content").
function env(nome) {
  const valor = process.env[nome];
  return valor ? valor.trim() : valor;
}

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
        env("INSTAGRAM_ACCESS_TOKEN") && env("INSTAGRAM_ACCOUNT_ID")
          ? { accessToken: env("INSTAGRAM_ACCESS_TOKEN"), accountId: env("INSTAGRAM_ACCOUNT_ID") }
          : null,
      facebook:
        env("FACEBOOK_PAGE_ACCESS_TOKEN") && env("FACEBOOK_PAGE_ID")
          ? { token: env("FACEBOOK_PAGE_ACCESS_TOKEN"), paginaId: env("FACEBOOK_PAGE_ID") }
          : null,
      twitter:
        env("TWITTER_API_KEY") && env("TWITTER_API_SECRET") && env("TWITTER_ACCESS_TOKEN") && env("TWITTER_ACCESS_SECRET")
          ? {
              apiKey: env("TWITTER_API_KEY"),
              apiSecret: env("TWITTER_API_SECRET"),
              accessToken: env("TWITTER_ACCESS_TOKEN"),
              accessSecret: env("TWITTER_ACCESS_SECRET"),
            }
          : null,
      linkedin:
        env("LINKEDIN_ACCESS_TOKEN") && env("LINKEDIN_AUTHOR_URN")
          ? { token: env("LINKEDIN_ACCESS_TOKEN"), autorUrn: env("LINKEDIN_AUTHOR_URN") }
          : null,
      threads:
        env("THREADS_ACCESS_TOKEN") && env("THREADS_USER_ID")
          ? { accessToken: env("THREADS_ACCESS_TOKEN"), userId: env("THREADS_USER_ID") }
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
  threads: (conteudo, credenciais) => threads.publicar(conteudo, credenciais),
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

// Ações de perfil (capa, foto de perfil, "sobre") — hoje só o Facebook expõe isso via API
// pública; o Instagram Graph API não tem endpoint de escrita pra bio/foto de perfil (só
// leitura), então essa parte continua manual no app do Instagram. Ver PUBLIQUE-IV.md.
async function atualizarPerfilFacebook({ contaId = "felizcred", capaUrl, fotoPerfilUrl, sobre }) {
  const conta = contaPorId(contaId);
  const credenciais = conta.redes.facebook;
  if (!credenciais) throw new Error("Sem credenciais do Facebook configuradas para esta conta.");

  const resultados = {};
  if (capaUrl) {
    try {
      resultados.capa = { ok: true, ...(await facebook.atualizarCapa(capaUrl, credenciais)) };
    } catch (err) {
      resultados.capa = { ok: false, erro: err.message };
    }
  }
  if (fotoPerfilUrl) {
    try {
      resultados.fotoPerfil = { ok: true, ...(await facebook.atualizarFotoPerfil(fotoPerfilUrl, credenciais)) };
    } catch (err) {
      resultados.fotoPerfil = { ok: false, erro: err.message };
    }
  }
  if (sobre) {
    try {
      resultados.sobre = { ok: true, ...(await facebook.atualizarSobre(sobre, credenciais)) };
    } catch (err) {
      resultados.sobre = { ok: false, erro: err.message };
    }
  }
  return resultados;
}

module.exports = { publicarEmTodos, listarContas, atualizarPerfilFacebook };
