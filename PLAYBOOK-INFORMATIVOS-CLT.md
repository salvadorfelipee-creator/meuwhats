# Playbook — 20 informativos "formato tuiter" (CLT/FGTS/INSS)

Série de posts informativos pro Instagram Stories da Felizcred, no formato de
print de post do X/Twitter (skill `carrossel-formato-tuiter`, modo `story`).
Cada post é uma imagem única: gancho + card de link pro artigo do blog
felizcred.com.br/blog — mesmo padrão do print de referência original (abono
salarial).

## Metodologia

- **Ganchos**: baseados em pesquisa de fraseado real de busca (Google/WebSearch)
  sobre abono salarial, seguro-desemprego, FGTS — linguagem de quem já está
  procurando a resposta ("tenho direito?", "o que fazer", "vale a pena").
- **Temas**: os 20 melhores artigos já publicados em `felizcred-site/blog/`
  (conteúdo real, sem inventar dado — cada post linka pro artigo correspondente).
- **Datas**: intercaladas com o story de construção civil já agendado
  (17, 20, 22, 25, 27, 30/08, às 12h) — essa série roda às 18h, preenchendo os
  dias vagos, do meio de agosto até o começo de outubro.

## Calendário

| # | Data | Horário | Gancho | Artigo (arquivo em felizcred-site/blog/) |
|---|------|---------|--------|------|
| 1 | 16/08 | 18h | Abono salarial 2026 já está caindo pra quem nasceu em novembro e dezembro. Você já conferiu se tem direito? | abono-salarial-pis-2026.html |
| 2 | 18/08 | 18h | Fui demitido — tenho direito ao seguro-desemprego? Quantas parcelas eu recebo? | seguro-desemprego-2026-duvidas-comuns.html |
| 3 | 21/08 | 18h | 13 direitos que todo trabalhador CLT tem e quase ninguém usa. | 13-direitos-trabalhador-clt-2025.html |
| 4 | 23/08 | 18h | 13º salário caindo na conta e você não sabe se guarda ou usa pra quitar dívida? | decimo-terceiro-salario-como-usar.html |
| 5 | 26/08 | 18h | Fui demitido sem justa causa. Quanto de multa de 40% do FGTS eu tenho direito? | multa-40-fgts-como-usar.html |
| 6 | 28/08 | 18h | Dá pra antecipar o FGTS em 2026? Veja as novas regras. | antecipacao-fgts-novas-regras-2025.html |
| 7 | 31/08 | 18h | Saque-aniversário do FGTS vale a pena ou é furada? | saque-aniversario-fgts-vale-a-pena.html |
| 8 | 02/09 | 18h | Empresa não depositou seu FGTS? Veja o que fazer e como denunciar. | fgts-atrasado-o-que-fazer.html |
| 9 | 05/09 | 18h | Fui demitido sem justa causa. O que acontece com meu FGTS e meu consignado agora? | demissao-sem-justa-causa-direitos-fgts-consignado.html |
| 10 | 07/09 | 18h | Patrão descumpriu a lei? Você pode pedir demissão e ainda sacar o FGTS. Veja como. | rescisao-indireta-direitos-fgts.html |
| 11 | 10/09 | 18h | Quanto do seu salário CLT você pode comprometer com empréstimo? Veja o limite real. | margem-consignavel-quanto-posso-pegar.html |
| 12 | 12/09 | 18h | Pagando caro no consignado? A portabilidade pode reduzir sua parcela sem trocar de banco. | portabilidade-consignado-clt-como-funciona.html |
| 13 | 15/09 | 18h | Consignado CLT agora aceita FGTS e multa rescisória como garantia. Entenda o que mudou. | novas-garantias-consignado-clt-fgts.html |
| 14 | 17/09 | 18h | Negativado consegue fazer consignado CLT? A resposta pode te surpreender. | negativado-emprestimo-consignado-clt.html |
| 15 | 20/09 | 18h | Crédito do Trabalhador: o novo consignado com o FGTS como garantia. Já ouviu falar? | credito-do-trabalhador-novo-consignado-privado.html |
| 16 | 22/09 | 18h | Afastado do trabalho por doença? Veja como pedir o auxílio-doença do INSS. | auxilio-doenca-inss.html |
| 17 | 25/09 | 18h | INSS negou ou atrasou seu auxílio-doença? Veja o que fazer agora. | auxilio-doenca-negado-atrasado-o-que-fazer.html |
| 18 | 27/09 | 18h | BPC/LOAS: quem tem direito a esse benefício de 1 salário mínimo? | bpc-loas-como-solicitar.html |
| 19 | 29/09 | 18h | Perdeu um familiar que era segurado do INSS? Veja quem tem direito à pensão por morte. | pensao-por-morte-inss.html |
| 20 | 02/10 | 18h | Nome sujo? O programa Desenrola Brasil pode ajudar a quitar suas dívidas usando o FGTS. | desenrola-brasil-fgts-pagar-dividas.html |

## Status

- [x] Playbook aprovado pelo usuário
- [x] 20 imagens geradas (skill `carrossel-formato-tuiter`, modo `story`)
- [x] 20 publicações agendadas via `/painel/api/agenda` (`redes: ["instagram_story"]`) — IDs 48-67 na fila

## Como foi feito (pra repetir depois)

1. Pesquisa de fraseado real (WebSearch, já que a CLI do `google-trends-research`
   não está instalada aqui)
2. Leitura dos `<title>` de cada artigo em `felizcred-site/blog/*.html` pra
   pegar tema + fraseado já validado (evita inventar dado novo)
3. Escrita dos ganchos no mesmo tom das buscas reais (2ª pessoa, pergunta direta)
4. Geração via `python3 "C:\Users\Salvador\.claude\skills\carrossel-formato-tuiter\generate.py" conteudo.json --mode story --out ./saida`,
   um JSON por post com `text` + `link: {domain, title}`
5. Agendamento em `/painel/api/agenda` (ver `PUBLIQUE-IV.md` pra credenciais/URL)
