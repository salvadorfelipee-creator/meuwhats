const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Cloudflare R2 é compatível com a API do S3 — usa o SDK oficial da AWS, só apontando pro
// endpoint da Cloudflare em vez da AWS. Substitui o Google Drive como "depósito" dos vídeos
// da fila de Reels (Service Account do Google não tem cota de armazenamento própria fora do
// Workspace — descoberto na prática em 11/08/2026, ver CHAVES-LOCAL.md).
function cliente() {
  const endpointBruto = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpointBruto || !accessKeyId || !secretAccessKey) {
    throw new Error("Credenciais do R2 não configuradas (R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY).");
  }
  // A Cloudflare mostra a URL já com o nome do bucket no final (.../felizcred-reels) — o SDK
  // do S3 espera só o endpoint base (protocolo + host), com o bucket informado à parte em
  // cada comando. Tira qualquer caminho colado a mais pra não precisar editar na mão.
  const { protocol, host } = new URL(endpointBruto);
  const endpoint = `${protocol}//${host}`;
  return new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
}

function bucket() {
  const nome = process.env.R2_BUCKET;
  if (!nome) throw new Error("R2_BUCKET não configurado.");
  return nome;
}

async function enviarVideo(key, buffer, contentType = "video/mp4") {
  await cliente().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: buffer, ContentType: contentType }));
  return { id: key, name: key };
}

// Lista todos os vídeos no bucket — equivalente ao drive.listarVideos() de antes.
// Devolve {id, name, size} pra bater com o formato que db.reelsSincronizarFila já espera.
async function listarVideos() {
  const s3 = cliente();
  const objetos = [];
  let continuationToken;
  do {
    const resp = await s3.send(new ListObjectsV2Command({ Bucket: bucket(), ContinuationToken: continuationToken }));
    for (const obj of resp.Contents || []) objetos.push({ id: obj.Key, name: obj.Key, size: obj.Size || 0 });
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);
  objetos.sort((a, b) => a.name.localeCompare(b.name));
  return objetos;
}

// URL assinada temporária pra Instagram/Facebook buscarem o vídeo direto do R2 — não passa
// pelo disco do nosso servidor (diferente do Drive, que exigia baixar os bytes primeiro).
async function urlAssinada(key, segundos = 900) {
  const s3 = cliente();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: segundos });
}

async function apagarVideo(key) {
  await cliente().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

async function usoTotalBytes() {
  const objetos = await listarVideos();
  return objetos.reduce((soma, o) => soma + o.size, 0);
}

module.exports = { enviarVideo, listarVideos, urlAssinada, apagarVideo, usoTotalBytes };
