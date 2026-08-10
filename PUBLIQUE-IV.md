# Publique IV

Sistema interno de publicação — publica o mesmo conteúdo em várias redes sociais com um
clique, direto do painel (`/painel`, aba 🚀 "Publicar"). Cada rede usa só o que ela aceita
daquele conteúdo (Instagram exige imagem, LinkedIn usa o link pra gerar a prévia, etc.).

## Objetivo

Você escreve **um** post (texto + opcionalmente imagem e/ou link) e escolhe quais redes
recebem. O sistema publica em paralelo lógico (uma rede por vez, mas nenhuma trava as
outras) e devolve o resultado individual de cada uma — se uma falhar (token vencido, rede
sem credencial, etc.) as demais continuam normalmente.

Hoje cobre: **Instagram, Facebook, X/Twitter e LinkedIn.**

## Como o conteúdo é adaptado por rede

| Rede | Texto | Imagem | Link |
|---|---|---|---|
| Instagram | vira a legenda | **obrigatória** — sem imagem, a publicação falha com erro claro | ignorado (Instagram não aceita link em post de feed) |
| Facebook | mensagem do post | se tiver, publica como foto (`/photos`); sem imagem, publica como texto/link (`/feed`) | usado só quando não há imagem |
| X/Twitter | corpo do tweet (corta em 280 caracteres se passar, e avisa no resultado) | opcional, sobe como mídia do tweet | não tem campo próprio — se quiser, inclua no texto |
| LinkedIn | `commentary` do post | **não sobe imagem própria** (exigiria o fluxo de registro de upload da LinkedIn — não implementado) | se tiver, LinkedIn gera a prévia/thumbnail automática do site |

## Arquitetura

```
publique.js          orquestrador: sabe quais contas existem e quais redes cada uma
                      tem configurada; publicarEmTodos() chama os adaptadores certos.
instagram.js          → publicarImagem()   (Instagram Graph API)
facebook.js           → publicar()         (Facebook Graph API)
twitter.js            → publicar()         (X API v2 + upload de mídia v1.1, OAuth 1.0a)
linkedin.js           → publicar()         (LinkedIn Posts API, /rest/posts)
server.js             rota POST /painel/api/publicar (dispara) e
                      GET  /painel/api/publicar/contas (lista contas/redes disponíveis)
public/painel.html    aba "Publicar" (🚀): formulário + checkboxes de rede + resultado
```

Cada rede-adaptador é uma função pura: recebe `{ texto, imagemUrl, link }` +
credenciais explícitas, e não lê `process.env` diretamente (exceto `instagram.js`, que
mantém compatibilidade com as funções antigas de leitura que já existiam antes do Publique
IV — se nenhuma credencial for passada, cai no token/conta padrão do Instagram).

## Contas — como adicionar uma nova

Todo o roteamento de "qual credencial usar" mora num único lugar: o array `CONTAS` no topo
de `publique.js`. Adicionar uma conta nova (outra marca, ex. Cota Certa Seguros) é:

1. Criar a conta/app em cada rede que for usar (ver seção seguinte).
2. Colocar as credenciais em variáveis de ambiente novas, com um sufixo pra não colidir com
   as da Felizcred — ex. `INSTAGRAM_COTACERTA_ACCESS_TOKEN`, `INSTAGRAM_COTACERTA_ACCOUNT_ID`.
3. Copiar o bloco `{ id: "felizcred", ... }` dentro de `CONTAS`, trocar `id`/`nome` e apontar
   pras variáveis novas.

Nenhum outro arquivo muda. Uma rede sem credencial simplesmente não aparece marcável no
painel para aquela conta (fica descrito como "sem credencial configurada").

```js
// publique.js
const CONTAS = [
  { id: "felizcred", nome: "Felizcred", redes: { /* ... */ } },
  {
    id: "cotacerta",
    nome: "Cota Certa Seguros",
    redes: {
      instagram: process.env.INSTAGRAM_COTACERTA_ACCESS_TOKEN && process.env.INSTAGRAM_COTACERTA_ACCOUNT_ID
        ? { accessToken: process.env.INSTAGRAM_COTACERTA_ACCESS_TOKEN, accountId: process.env.INSTAGRAM_COTACERTA_ACCOUNT_ID }
        : null,
      facebook: null, // ainda sem Página própria
      twitter: null,
      linkedin: null,
    },
  },
];
```

## Onde criar as credenciais de cada rede

- **Instagram / Facebook**: mesmo App da Meta já usado pelo resto do projeto
  (developers.facebook.com) — Instagram precisa de `INSTAGRAM_ACCESS_TOKEN`/`ACCOUNT_ID`
  (já documentado no README principal); Facebook precisa de um token de **Página** com
  permissão `pages_manage_posts` (gerado no mesmo App, em Ferramentas → Explorador da API
  Graph, escolhendo a Página certa).
- **X/Twitter**: criar um App em developer.x.com (plano Free serve — 50 posts/dia), ativar
  permissão de leitura+escrita, gerar API Key/Secret do App e Access Token/Secret da conta
  que vai postar (não do App).
- **LinkedIn**: criar um App em linkedin.developer.com, pedir o produto "Share on LinkedIn"
  (libera `w_member_social`), gerar um Access Token OAuth2 e pegar o URN do autor
  (`urn:li:person:...` pra perfil pessoal, `urn:li:organization:...` pra Página da empresa —
  esse exige o produto "Community Management API" aprovado).

## Status

Código escrito seguindo a documentação oficial de cada API, mas **ainda não testado contra
nenhuma API real** — nenhuma das contas de X/Twitter/LinkedIn/Facebook (Página com token de
publicação) existe ainda. Antes de confiar em publicações automáticas de verdade, faça um
primeiro teste manual por rede e confira o resultado no ar.

Pendências de conta/chave: ver `CHAVES-LOCAL.md`.
