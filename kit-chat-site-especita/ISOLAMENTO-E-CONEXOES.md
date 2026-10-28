# Isolamento e conexões: Especitá × Meu WhatsApp

Regra única: **código pode ser copiado, infraestrutura nunca.** Tudo que a Especitá liga ao chat do site é dela, criado nos serviços dela.

## 1. O que a Especitá usa (dela, já documentado no CLAUDE.md dela)
| Peça | Valor da Especitá | Onde confirmar |
|---|---|---|
| Repositório | `especitaodonto/Whatsappespecita` | `git remote -v` na pasta da Especitá |
| Servidor (Render) | serviço `Whatsappespecita` | CLAUDE.md da Especitá |
| URL do painel/API | `https://painel.clinicaespecita.com` | CLAUDE.md da Especitá |
| Banco | `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` **da Especitá** (variáveis do Render dela) | painel do Render dela |
| Arquivos (R2) | bucket **da Especitá** | variáveis do Render dela |
| Site | domínio do site da Especitá (**a definir**, ver item 3) | perguntar ao Salvador se não estiver documentado |

Se algum valor acima não estiver confirmado no CLAUDE.md da Especitá na hora, **pergunte**; não deduza por semelhança de código.

## 2. Variáveis de ambiente novas (só o NOME vai para o código; o valor é digitado no Render da Especitá)
| Variável | Para quê | Exemplo de valor (não é segredo) |
|---|---|---|
| `SITE_CHAT_ORIGENS` | origens do site autorizadas a falar com a API (CORS), separadas por vírgula | `https://www.dominio-do-site.com.br,https://dominio-do-site.com.br` |

O chat **não** precisa de token novo: a chave de cada visitante é gerada na hora (32 bytes aleatórios; só o hash SHA-256 fica no banco).

## 3. Como o site da Especitá encontra o painel
O site (estático, em outro domínio) chama a API do painel. No HTML do site:
```html
<link rel="stylesheet" href="/chat-widget.css">
<script src="/chat-widget.js" defer data-api="https://painel.clinicaespecita.com" data-marca="Especitá"></script>
```
- `data-api` = URL do painel **da Especitá** (item 1). Nunca `meuwhats.onrender.com`.
- O domínio do site entra em `SITE_CHAT_ORIGENS`. Sem isso o navegador recebe 403 (isso é proposital).
- Em desenvolvimento local, acrescente `http://localhost:8000` só no ambiente de teste, nunca na produção.

## 4. O que NÃO copiar do Meu WhatsApp (mesmo que apareça em "código parecido")
- Domínios `felizcred.com.br`, `meuwhats.onrender.com`; o número de WhatsApp fixo em `site-chat-rules.js`.
- Qualquer `.env`, `CHAVES-LOCAL.md`, tokens, IDs de WABA/BM/página, chaves de Brevo, Gemini, Facta, Unnotech, R2.
- Tabelas `site_chat_*`, `retornos`, lógica CLT/FGTS/Facta, "Assistente FelizCred", textos de produto. Tudo isso é de crédito consignado.
- `felizcred-site/`, `cotacerta-seguros/`, `ciahot/`: sites de outros negócios.

## 5. Como NÃO misturar (verificações antes de qualquer commit na Especitá)
1. `git remote -v` aponta para `especitaodonto/Whatsappespecita`.
2. `grep -rniE "felizcred|cotacerta|ciahot|meuwhats|facta|unno" <arquivos novos>` não encontra nada.
3. `grep -rn "onrender.com" <arquivos novos>` só pode achar o serviço da Especitá.
4. Nenhum valor de variável de ambiente escrito no código (só `process.env.NOME`).
5. O commit é feito **com a pasta da Especitá como diretório de trabalho**.

## 6. Banda e custo (lição do projeto original)
No Meu WhatsApp o Render foi suspenso por estouro de banda (23/10/2026) por causa de consultas repetitivas. O widget já economiza: só consulta com o chat **aberto** e a aba **visível**, a cada 4 s, e a cada 15 s depois de 2 min sem novidade. O painel reaproveita a consulta periódica que já existe. Se o site tiver muito tráfego, aumente o intervalo em vez de abrir conexão permanente.

## 7. Dados pessoais (LGPD)
O chat coleta nome e celular (e-mail opcional). Coloque no formulário do site um link para a política de privacidade da Especitá. Mensagens de clínica podem citar saúde (dado sensível): mantenha o chat só para agendamento e dúvidas gerais, e avise isso na saudação do fluxo.
