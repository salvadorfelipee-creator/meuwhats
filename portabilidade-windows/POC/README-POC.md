# POC — padrão de launcher portátil

Prova de conceito isolada (arquivos novos, nada do projeto atual foi
tocado) validando o padrão central descrito em
[`../../PROJETO-PORTABILIDADE-WINDOWS.md`](../../PROJETO-PORTABILIDADE-WINDOWS.md):
um `.bat` que resolve seu próprio caminho, carrega variáveis de ambiente de
um arquivo local e sobe um processo Node — igual o `iniciar.bat` real vai
fazer com `server.js`.

## Arquivos

- `poc-app.js` — mini servidor HTTP (mesmo módulo `http` nativo que
  `server.js` usa, sem framework). Ao subir: grava um arquivo
  (`poc-output.txt`) usando `__dirname`, lê uma variável de ambiente vinda
  do `.env.poc`, sobe um servidor HTTP por 5s e se encerra sozinho.
- `.env.poc.example` — modelo do arquivo de configuração local (valores
  fictícios, sem segredo real).
- `iniciar-poc.bat` — launcher: resolve `%~dp0` (seu próprio caminho),
  copia `.env.poc.example` para `.env.poc` na primeira vez, carrega as
  variáveis linha a linha e chama `node poc-app.js`.

`.env.poc` e `poc-output.txt` são gerados na hora e ficam de fora do git
(ver `.gitignore` desta pasta).

## Como rodar

Duplo clique em `iniciar-poc.bat`, ou por terminal:

```powershell
cd portabilidade-windows\POC
.\iniciar-poc.bat
```

## O que isso prova (validado em 2026-09-27)

Rodando o `.bat` a partir de um diretório **diferente** do dele
(`C:\Users\...\Documents`, enquanto o `.bat` está em
`...\portabilidade-windows\POC\`), a saída confirmou:

```
[POC] Launcher rodando a partir de: C:\...\portabilidade-windows\POC\
[POC] Diretorio atual (CWD) neste momento: C:\Users\Salvador\Documents
[POC] __dirname (pasta real do script) = C:\...\portabilidade-windows\POC
[POC] POC_SEGREDO_TESTE (vindo do .env.poc) = valor-de-teste-123
[POC] servidor de teste rodando em http://localhost:4321
[POC] encerrado.
```

Ou seja:

1. **`%~dp0` resolve certo** mesmo quando o `.bat` é chamado de fora da sua
   própria pasta (o caso real de alguém dando duplo clique a partir do
   Explorer, de um atalho, ou de outra pasta qualquer).
2. **`.env.poc` foi carregado** — o valor `POC_SEGREDO_TESTE` apareceu
   dentro do processo Node, vindo de um arquivo local, sem `dotenv`
   instalado (mesmo padrão que `server.js` vai usar, já que o projeto lê
   `process.env.*` direto).
3. **Escrita de arquivo usando `__dirname`** foi pro lugar certo
   (`.../POC/poc-output.txt`), não pro `cwd` — prova que os `require`s e
   caminhos relativos de `server.js` (que também usam `__dirname`/relativo)
   vão continuar funcionando iguais dentro do pacote portátil.

## Nota técnica (armadilha encontrada durante a POC)

A primeira versão do `iniciar-poc.bat` foi salva só com quebra de linha
`LF` (padrão Unix) e travou o `cmd.exe` no meio do arquivo (erros tipo
`'ocal' não é reconhecido`, comandos cortados ao meio). Batch files do
Windows esperam `CRLF`. Corrigido convertendo o arquivo pra `CRLF` antes de
rodar — vale lembrar disso no `iniciar.bat` real na Etapa 8 do
[runbook](../runbook.md): gerar/editar arquivos `.bat` sempre com quebra de
linha Windows (`CRLF`), nunca `LF` puro.
