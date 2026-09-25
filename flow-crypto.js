// flow-crypto.js — criptografia híbrida RSA-OAEP + AES-128-GCM exigida pelo endpoint de dados
// de um WhatsApp Flow (ver docs da Meta: "Endpoint for Flows — Encryption"). Isolado num
// arquivo próprio por ser um protocolo bem específico, sem nada a ver com o resto do domínio.
const crypto = require("crypto");

function decrypt(encryptedFlowDataB64, encryptedAesKeyB64, ivB64) {
  const privateKey = crypto.createPrivateKey({
    key: process.env.FGTS_FLOW_PRIVATE_KEY,
    format: "pem",
  });
  const aesKey = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(encryptedAesKeyB64, "base64")
  );
  const flowDataBuffer = Buffer.from(encryptedFlowDataB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = flowDataBuffer.subarray(flowDataBuffer.length - 16);
  const cipherText = flowDataBuffer.subarray(0, flowDataBuffer.length - 16);
  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return { aesKey, iv, request: JSON.parse(decrypted.toString("utf8")) };
}

// A resposta usa a MESMA chave AES, mas com todo byte do IV invertido (regra explícita da Meta,
// pra garantir que request/response nunca reusem o mesmo par chave+IV).
function encrypt(responseObj, aesKey, iv) {
  const ivInvertido = Buffer.from(iv.map((b) => b ^ 0xff));
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, ivInvertido);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(responseObj), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]).toString("base64");
}

module.exports = { decrypt, encrypt };
