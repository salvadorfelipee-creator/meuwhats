# Instruções para o Codex — consertar o Git local (18/11/2026)

## Problema
`git pull` e `git fetch` falham neste repositório com:

```
fatal: bad object refs/codex/turn-diffs/captures/1792239497949/c32a63a7-af71-414e-8b6d-2451a88d5b45/base
error: https://github.com/salvadorfelipee-creator/meuwhats.git did not send all necessary objects
error: failed to perform geometric repack
```

Há uma referência local `refs/codex/turn-diffs/...` apontando para um objeto que não existe (criada pelo Codex). Ela quebra qualquer fetch/pull.

## O que fazer (só você, Codex; o Claude não mexe nisso)
1. Rode a partir da raiz `C:\Users\Salvador\Documents\meuwhatsapp` (repo `salvadorfelipee-creator/meuwhats`).
2. Liste as referências quebradas: `git for-each-ref refs/codex` e confira quais apontam para objeto inexistente (`git cat-file -t <sha>`).
3. Apague só as referências quebradas: `git update-ref -d refs/codex/turn-diffs/captures/1792239497949/c32a63a7-af71-414e-8b6d-2451a88d5b45/base` (e outras iguais, se houver). Não apague nada fora de `refs/codex/`.
4. Rode `git fetch origin` e `git pull --rebase origin main`.
5. Confirme que `nexus-reels/estado.json` agora lista os Reels publicados pela nuvem (1, 2, 3, 4 e os seguintes), não só 1, 2 e 3.

## Por que importa
O bot do GitHub (`.github/workflows/nexus-reels.yml`) publica 4 Reels por dia (8h, 12h, 17h e 20h, Brasília) no Instagram @nexusssites e no Threads, e commita `nexus-reels/estado.json` com o que já foi postado. A fila segue na nuvem, mas o `estado.json` local está desatualizado. Se alguém rodar `node nexus-reels/publicar.js` localmente sem sincronizar, pode repetir um Reel já publicado.

## Não faça
- Não commite nem exponha segredos (`.env`, `CHAVES-LOCAL.md`).
- Não faça push forçado.
- Não mexa nos arquivos soltos não relacionados: `COSTOS-WHATSAPP-RESUMO.txt`, `consultar-custos*.js`, `v8-digital-conceito/`.
