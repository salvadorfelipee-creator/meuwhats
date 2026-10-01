// cpf.js — validação de CPF (dígito verificador), compartilhada entre unnotech.js e
// novosaque.js (extraído em 01/10/2026 quando o 2º cliente de API passou a precisar da mesma
// função — antes vivia só dentro de unnotech.js).
function cpfValido(cpf) {
  const c = String(cpf || "").replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false; // 11 dígitos iguais não é CPF real
  const digitos = c.split("").map(Number);
  const calcularDigito = (fatorInicial) => {
    let soma = 0;
    for (let i = 0; i < fatorInicial - 1; i++) soma += digitos[i] * (fatorInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calcularDigito(10) === digitos[9] && calcularDigito(11) === digitos[10];
}

module.exports = { cpfValido };
