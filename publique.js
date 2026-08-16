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
      // Mesma credencial do Instagram acima — é a mesma conta, só um tipo de publicação
      // diferente (Stories em vez de feed). Fica marcável/desmarcável separado no painel.
      instagram_story:
        env("INSTAGRAM_ACCESS_TOKEN") && env("INSTAGRAM_ACCOUNT_ID")
          ? { accessToken: env("INSTAGRAM_ACCESS_TOKEN"), accountId: env("INSTAGRAM_ACCOUNT_ID") }
          : null,
      instagram_reels:
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
  {
    id: "cotacerta",
    nome: "Cota Certa Seguros",
    redes: {
      // host: "graph.facebook.com" (em vez do padrão graph.instagram.com) porque essa conta
      // usa um token de Usuário do Sistema (Business Manager, "Nunca expira") em vez do fluxo
      // "Login do Instagram" que a Felizcred usa — token de Usuário do Sistema só fala com a
      // Graph API clássica do Facebook, não com o host específico do Login do Instagram.
      instagram:
        env("INSTAGRAM_COTACERTA_ACCESS_TOKEN") && env("INSTAGRAM_COTACERTA_ACCOUNT_ID")
          ? { accessToken: env("INSTAGRAM_COTACERTA_ACCESS_TOKEN"), accountId: env("INSTAGRAM_COTACERTA_ACCOUNT_ID"), host: "graph.facebook.com" }
          : null,
      instagram_story:
        env("INSTAGRAM_COTACERTA_ACCESS_TOKEN") && env("INSTAGRAM_COTACERTA_ACCOUNT_ID")
          ? { accessToken: env("INSTAGRAM_COTACERTA_ACCESS_TOKEN"), accountId: env("INSTAGRAM_COTACERTA_ACCOUNT_ID"), host: "graph.facebook.com" }
          : null,
      instagram_reels:
        env("INSTAGRAM_COTACERTA_ACCESS_TOKEN") && env("INSTAGRAM_COTACERTA_ACCOUNT_ID")
          ? { accessToken: env("INSTAGRAM_COTACERTA_ACCESS_TOKEN"), accountId: env("INSTAGRAM_COTACERTA_ACCOUNT_ID"), host: "graph.facebook.com" }
          : null,
      facebook:
        env("FACEBOOK_COTACERTA_PAGE_ACCESS_TOKEN") && env("FACEBOOK_COTACERTA_PAGE_ID")
          ? { token: env("FACEBOOK_COTACERTA_PAGE_ACCESS_TOKEN"), paginaId: env("FACEBOOK_COTACERTA_PAGE_ID") }
          : null,
      twitter:
        env("TWITTER_COTACERTA_API_KEY") && env("TWITTER_COTACERTA_API_SECRET") && env("TWITTER_COTACERTA_ACCESS_TOKEN") && env("TWITTER_COTACERTA_ACCESS_SECRET")
          ? {
              apiKey: env("TWITTER_COTACERTA_API_KEY"),
              apiSecret: env("TWITTER_COTACERTA_API_SECRET"),
              accessToken: env("TWITTER_COTACERTA_ACCESS_TOKEN"),
              accessSecret: env("TWITTER_COTACERTA_ACCESS_SECRET"),
            }
          : null,
      linkedin:
        env("LINKEDIN_COTACERTA_ACCESS_TOKEN") && env("LINKEDIN_COTACERTA_AUTHOR_URN")
          ? { token: env("LINKEDIN_COTACERTA_ACCESS_TOKEN"), autorUrn: env("LINKEDIN_COTACERTA_AUTHOR_URN") }
          : null,
      threads:
        env("THREADS_COTACERTA_ACCESS_TOKEN") && env("THREADS_COTACERTA_USER_ID")
          ? { accessToken: env("THREADS_COTACERTA_ACCESS_TOKEN"), userId: env("THREADS_COTACERTA_USER_ID") }
          : null,
    },
  },
  {
    id: "ciahot",
    nome: "Ciahot",
    redes: {
      instagram:
        env("INSTAGRAM_CIAHOT_ACCESS_TOKEN") && env("INSTAGRAM_CIAHOT_ACCOUNT_ID")
          ? { accessToken: env("INSTAGRAM_CIAHOT_ACCESS_TOKEN"), accountId: env("INSTAGRAM_CIAHOT_ACCOUNT_ID") }
          : null,
      instagram_story:
        env("INSTAGRAM_CIAHOT_ACCESS_TOKEN") && env("INSTAGRAM_CIAHOT_ACCOUNT_ID")
          ? { accessToken: env("INSTAGRAM_CIAHOT_ACCESS_TOKEN"), accountId: env("INSTAGRAM_CIAHOT_ACCOUNT_ID") }
          : null,
      instagram_reels:
        env("INSTAGRAM_CIAHOT_ACCESS_TOKEN") && env("INSTAGRAM_CIAHOT_ACCOUNT_ID")
          ? { accessToken: env("INSTAGRAM_CIAHOT_ACCESS_TOKEN"), accountId: env("INSTAGRAM_CIAHOT_ACCOUNT_ID") }
          : null,
      facebook:
        env("FACEBOOK_CIAHOT_PAGE_ACCESS_TOKEN") && env("FACEBOOK_CIAHOT_PAGE_ID")
          ? { token: env("FACEBOOK_CIAHOT_PAGE_ACCESS_TOKEN"), paginaId: env("FACEBOOK_CIAHOT_PAGE_ID") }
          : null,
      twitter:
        env("TWITTER_CIAHOT_API_KEY") && env("TWITTER_CIAHOT_API_SECRET") && env("TWITTER_CIAHOT_ACCESS_TOKEN") && env("TWITTER_CIAHOT_ACCESS_SECRET")
          ? {
              apiKey: env("TWITTER_CIAHOT_API_KEY"),
              apiSecret: env("TWITTER_CIAHOT_API_SECRET"),
              accessToken: env("TWITTER_CIAHOT_ACCESS_TOKEN"),
              accessSecret: env("TWITTER_CIAHOT_ACCESS_SECRET"),
            }
          : null,
      linkedin:
        env("LINKEDIN_CIAHOT_ACCESS_TOKEN") && env("LINKEDIN_CIAHOT_AUTHOR_URN")
          ? { token: env("LINKEDIN_CIAHOT_ACCESS_TOKEN"), autorUrn: env("LINKEDIN_CIAHOT_AUTHOR_URN") }
          : null,
      threads:
        env("THREADS_CIAHOT_ACCESS_TOKEN") && env("THREADS_CIAHOT_USER_ID")
          ? { accessToken: env("THREADS_CIAHOT_ACCESS_TOKEN"), userId: env("THREADS_CIAHOT_USER_ID") }
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

// Cada adaptador recebe o mesmo conteúdo genérico { texto, imagemUrl, imagemUrls, link } e usa
// só o que a rede aceita. `imagemUrls` (array, 2+ imagens) pede um carrossel — Instagram,
// Facebook, Threads e LinkedIn sabem publicar isso; nas demais (Stories, X/Twitter) o
// adaptador recusa com um erro claro em vez de postar algo fora do formato pedido. Ver
// PUBLIQUE-IV.md pra tabela completa.
const ADAPTADORES = {
  instagram: (conteudo, credenciais) => {
    if (conteudo.imagemUrls && conteudo.imagemUrls.length) {
      return instagram.publicarCarrossel({
        imagemUrls: conteudo.imagemUrls,
        legenda: conteudo.texto,
        accessToken: credenciais.accessToken,
        accountId: credenciais.accountId,
        host: credenciais.host,
      });
    }
    if (!conteudo.imagemUrl) throw new Error("Instagram exige uma imagem.");
    return instagram.publicarImagem({
      imagemUrl: conteudo.imagemUrl,
      legenda: conteudo.texto,
      accessToken: credenciais.accessToken,
      accountId: credenciais.accountId,
      host: credenciais.host,
    });
  },
  instagram_story: (conteudo, credenciais) => {
    if (conteudo.imagemUrls && conteudo.imagemUrls.length) {
      throw new Error("Instagram Stories não suporta carrossel (formato de várias imagens deslizáveis).");
    }
    if (!conteudo.imagemUrl && !conteudo.videoUrl) throw new Error("Story exige uma imagem ou um vídeo.");
    return instagram.publicarStory({
      imagemUrl: conteudo.imagemUrl,
      videoUrl: conteudo.videoUrl,
      accessToken: credenciais.accessToken,
      accountId: credenciais.accountId,
      host: credenciais.host,
    });
  },
  facebook: (conteudo, credenciais) => {
    if (conteudo.imagemUrls && conteudo.imagemUrls.length) {
      return facebook.publicarCarrossel({ texto: conteudo.texto, imagemUrls: conteudo.imagemUrls }, credenciais);
    }
    return facebook.publicar(conteudo, credenciais);
  },
  // Reels — mesma credencial do Instagram (reaproveita accessToken/accountId/host), só muda
  // o tipo de mídia (vídeo em vez de imagem). Ver criarAgendamento em agenda.js (videoBuffer).
  instagram_reels: (conteudo, credenciais) => {
    if (!conteudo.videoUrl) throw new Error("Reels exige um vídeo.");
    return instagram.publicarReels({
      videoUrl: conteudo.videoUrl,
      legenda: conteudo.texto,
      accessToken: credenciais.accessToken,
      accountId: credenciais.accountId,
      host: credenciais.host,
    });
  },
  twitter: (conteudo, credenciais) => {
    if (conteudo.imagemUrls && conteudo.imagemUrls.length) {
      throw new Error("X/Twitter não suporta carrossel neste sistema ainda.");
    }
    return twitter.publicar(conteudo, credenciais);
  },
  linkedin: (conteudo, credenciais) => linkedin.publicar(conteudo, credenciais),
  threads: (conteudo, credenciais) => {
    if (conteudo.imagemUrls && conteudo.imagemUrls.length) {
      return threads.publicarCarrossel({ texto: conteudo.texto, imagemUrls: conteudo.imagemUrls }, credenciais);
    }
    return threads.publicar(conteudo, credenciais);
  },
};

// Publica o mesmo conteúdo em várias redes de uma vez (um clique). Cada rede publica
// independente das outras — se uma falhar (token vencido, rede sem credencial, rede sem
// suporte a carrossel etc.) as demais continuam, e o motivo de cada falha vai no resultado.
// `imagemUrlPorRede` (objeto { rede: url }) é um ajuste manual feito no painel (enquadrar/
// reposicionar a foto pra não cortar errado numa rede específica, ex. Stories 9:16) — quando
// existe pra uma rede, essa URL vence a `imagemUrl` genérica só pra ela; as outras redes
// continuam usando a imagem padrão normalmente.
async function publicarEmTodos({ contaId = "felizcred", texto, imagemUrl, imagemUrls, imagemUrlPorRede, videoUrl, link, redes }) {
  const conta = contaPorId(contaId);
  const alvo = redes && redes.length ? redes : Object.keys(conta.redes);
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
    const conteudo = { texto, imagemUrl: imagemUrlPorRede?.[rede] || imagemUrl, imagemUrls, videoUrl, link };
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
