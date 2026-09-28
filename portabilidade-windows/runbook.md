# Runbook — montar o pacote portátil (execução por IA)

> Pré-requisito de leitura: [`PROJETO-PORTABILIDADE-WINDOWS.md`](../PROJETO-PORTABILIDADE-WINDOWS.md)
> na raiz do projeto. Este runbook assume a decisão já tomada lá (Opção 1 —
> pacote portátil) e não precisa ser relida do zero.
>
> Regra de ouro: **nenhum arquivo do projeto atual é alterado.** Tudo que
> este runbook produz é novo, dentro de uma pasta de saída separada.

Cada etapa abaixo é sequencial. Se uma etapa falhar, pare e reporte — não
pule pra próxima.

## Etapa 0 — Confirmar com o usuário antes de rodar

Antes de executar qualquer coisa deste runbook, confirme com o usuário:

1. **Pasta de saída do pacote** — sugestão: `../felizcred-portatil/` (fora do
   repo git, pra não versionar `node_modules` nem o Node portátil por
   engano).
2. **Se é pra incluir os segredos reais agora** ou só montar a estrutura e
   deixar o `config/.env` vazio pro usuário preencher depois à mão. Nunca
   copie segredos sem essa confirmação explícita.

## Etapa 1 — Levantar a versão do Node a usar

```bash
node -v
```

Use essa mesma major version pro Node portátil (o projeto exige `>=18` em
`package.json`, mas rodar com a mesma versão do ambiente de desenvolvimento
evita qualquer diferença de comportamento).

## Etapa 2 — Baixar o Node.js portátil pra Windows

Baixar o zip oficial (não o instalador) em `https://nodejs.org/dist/` —
arquivo `node-vX.Y.Z-win-x64.zip` (mesma major da Etapa 1). Extrair para
`<pasta-de-saída>/node-portable/`, de forma que
`<pasta-de-saída>/node-portable/node.exe` exista.

## Etapa 3 — Copiar o projeto sem lixo

Copiar a raiz do projeto para `<pasta-de-saída>/app/`, **excluindo**:

- `.git/`
- `node_modules/.cache` (se existir)
- `painel-web/node_modules` (não precisa — só o `dist` final)
- Qualquer coisa já listada em `.gitignore` que seja de desenvolvimento
  (logs, `__pycache__`, etc.) — mas **mantendo** `node_modules/` da raiz
  (esse precisa ir, é o runtime da aplicação).

Comando de referência (ajustar pasta de saída):

```bash
rsync -a --exclude='.git' --exclude='painel-web/node_modules' \
  ./ "<pasta-de-saída>/app/"
```

(Se `rsync` não estiver disponível no ambiente, usar `robocopy` no
PowerShell com as mesmas exclusões.)

## Etapa 4 — Instalar dependências de produção dentro da cópia

Dentro de `<pasta-de-saída>/app/`:

```bash
npm install --omit=dev
```

Isso garante que `playwright` (devDependency, não usada em runtime — ver
seção 6 do doc de arquitetura) não entra no pacote, e que
`@libsql/win32-x64-msvc` está presente e resolvido pra Windows x64.

## Etapa 5 — Buildar o painel

Ainda em `<pasta-de-saída>/app/`:

```bash
npm run build
```

(Esse script já roda `npm install --prefix painel-web && npm run build
--prefix painel-web`, conforme definido em `package.json`.) Confirmar que
`<pasta-de-saída>/app/painel-web/dist/index.html` existe ao final.

## Etapa 6 — Levantar as variáveis de ambiente necessárias

Gerar a lista **direto do código-fonte**, não copiar de uma lista
estática (o código muda com o tempo):

```bash
grep -hoE "process\.env\.[A-Z_][A-Z0-9_]*" *.js | sort -u | sed 's/process\.env\.//'
```

Rodar esse comando na raiz do projeto original (não na cópia). Usar o
resultado pra montar `<pasta-de-saída>/config/.env.example` com uma linha
`NOME_DA_VARIAVEL=` por variável encontrada (vazio — são só os nomes, nunca
os valores reais nesse arquivo de exemplo).

## Etapa 7 — Criar `config/.env` real (só se autorizado na Etapa 0)

Se o usuário autorizou, copiar os valores reais de onde eles já existem
localmente (`CHAVES-LOCAL.md` ou variáveis já configuradas no Render) para
`<pasta-de-saída>/config/.env`. Esse arquivo:

- **Nunca** entra em nenhum `git add`, nem no repo principal nem em nenhum
  outro.
- Se a pasta de saída ficar dentro de qualquer repo git, adicionar
  `config/.env` ao `.gitignore` daquele repo imediatamente.

## Etapa 8 — Criar o launcher `iniciar.bat`

Criar `<pasta-de-saída>/iniciar.bat` seguindo exatamente o padrão validado
na POC (`portabilidade-windows/POC/iniciar-poc.bat`): resolve o próprio
caminho com `%~dp0`, carrega `config\.env` linha a linha para variáveis de
ambiente do processo, depois chama `node-portable\node.exe app\server.js`.
Não reinventar o padrão — copiar a lógica da POC e só trocar os nomes de
arquivo/pasta.

**Armadilha já encontrada na POC:** salvar o `.bat` com quebra de linha
`LF` (padrão Unix) trava o `cmd.exe` no meio do arquivo. Garantir que o
arquivo final está em `CRLF` (padrão Windows) antes de testar — ver nota
técnica em [`POC/README-POC.md`](POC/README-POC.md).

## Etapa 9 — Testar de ponta a ponta

1. Rodar `iniciar.bat` por duplo clique (ou `cmd /c iniciar.bat` a partir de
   um diretório diferente, pra confirmar que o `%~dp0` resolve certo mesmo
   fora da pasta).
2. Confirmar no terminal que o servidor sobe na porta esperada
   (`process.env.PORT` ou 3000).
3. Abrir `http://localhost:<porta>/` (ou a rota do painel) no navegador e
   confirmar que o painel carrega (prova que `painel-web/dist` está sendo
   servido corretamente a partir da nova pasta).
4. Confirmar que uma ação que toca o banco (ex: carregar a lista de
   conversas no painel) funciona — prova que a conexão com o Turso funciona
   igual, vindo de uma máquina/pasta diferente.

## Etapa 10 — Compactar para transporte

```bash
cd <pasta-de-saída>
zip -r felizcred-portatil.zip . -x "config/.env"
```

Transportar `config/.env` **separado** do zip (nunca junto), por um canal
que não seja git/zip compartilhado sem criptografia.

## Etapa 11 — Documentar o resultado

Atualizar a seção "7. Próximos passos" de
`PROJETO-PORTABILIDADE-WINDOWS.md` com a data em que o pacote foi montado
pela primeira vez e qualquer ajuste feito durante a execução deste runbook
que divirja do que está descrito (pra manter o doc como fonte da verdade,
igual já se faz com o README do projeto).
