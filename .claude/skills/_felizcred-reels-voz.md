# Voz dos Reels — Felizcred

Documento de apoio lido por `reels-ideias`, `reels-copywriter` e `reels-trial-hooks` antes de
escrever qualquer coisa. Não é uma skill — é o "voice.md" do sistema de Reels. Editável a
qualquer momento; a primeira versão foi escrita a partir do que já existia no projeto
(fluxo real do WhatsApp, memória de negócio), não de uma entrevista do zero.

## Marca e produtos (fonte da verdade: só o que já é oferecido de verdade)

Felizcred é correspondente bancário. Produtos reais, nessa ordem de prioridade (mesma ordem
do menu real do WhatsApp):

1. Empréstimo consignado CLT (carteira assinada, mínimo 3 meses de carteira)
2. Seguro de carro/moto
3. Empréstimo com carro em garantia (carro não pode estar alienado)
4. Financiamento de veículo
5. Saque-aniversário do FGTS

Nunca inventar um produto, taxa, prazo ou condição que não esteja confirmado no código do
projeto (`server.js`, `TEXTO_MENU_PRINCIPAL`) ou que o usuário não tenha confirmado na
conversa. Mesma regra factual já aplicada ao conteúdo da Cota Certa Seguros: dado financeiro
errado em vídeo público é pior que não postar.

## Público

Trabalhador CLT (carteira assinada) buscando crédito rápido, ou alguém com FGTS parado, ou
dono de carro/moto pensando em seguro ou usando o veículo como garantia. Não é um público
sofisticado em finanças — quer entender rápido se aquilo serve pro caso dele, sem jargão
bancário.

## Tom

Direto, sem enrolação, mesmo registro que o atendente real (Felipe) já usa no WhatsApp —
frases curtas, sem "linguagem de banco". Nunca promete aprovação garantida (o crédito depende
de uma checagem manual real feita por um humano num portal de banco parceiro — nenhum vídeo
deve dar a entender que é automático ou garantido).

## Formato: sem rosto

Ninguém aparece na câmera. Cada roteiro é pensado pra **voz em off + texto na tela**, não
pra alguém falando pro celular. Isso muda como o hook funciona: não é uma linha de abertura
de duas frases de texto (formato LinkedIn) — é a primeira frase que a narração fala nos
primeiros 2-3 segundos, com uma marcação do que aparece escrito na tela naquele momento.

## CTA — sempre fecha no WhatsApp

Todo roteiro termina levando pro WhatsApp da Felizcred, no mesmo espírito do funil que já
existe (`menuInicial()` em `server.js`): call to action simples, tipo "manda mensagem no
WhatsApp que a gente te fala se dá" — nunca um CTA vago tipo "saiba mais" sem destino.

## Fonte real de linguagem do cliente (use quando existir, nunca cite literalmente)

Existe uma pasta local `felizcred-site/logo/chats/` (fora do git, tem PII real: nome, CPF,
telefone) com conversas reais de atendimento. Se estiver disponível na hora de escrever um
roteiro, vale espiar pra pegar a forma real como cliente pergunta/hesita — mas nunca citar
nome, CPF, telefone ou trecho literal de cliente real em conteúdo público. Use "um cliente
perguntou..." sem identificar ninguém.

## O que não fazer

- Não prometer valor de parcela, taxa de juros ou prazo específico sem confirmar no código
  ou com o usuário.
- Não dar a entender que a aprovação é automática ou instantânea.
- Não usar hook de medo/urgência falsa ("ÚLTIMOS DIAS", "vai acabar") sem isso ser verdade.
- Não copiar formato de hook de texto do LinkedIn (duas linhas de 40 caracteres) — isso é
  pra feed de texto, não pra voz em off de Reels.
