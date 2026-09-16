# Projeto: Automação de casa via WhatsApp (SMHUB + Home Assistant)

> **Status: planejamento, NÃO iniciado.** Este arquivo é o briefing completo pra
> usar quando decidirmos começar a construir. Reúne o que já foi pesquisado e
> decidido, pra não precisar re-explicar do zero. Separado de tudo relacionado a
> Felizcred/Cota Certa — aqui é automação residencial pessoal, que só reaproveita
> a infra do bot de WhatsApp que já existe neste repo.

## 1. O que é

- **SMHUB**: hub físico (fabricante SMLIGHT) que coordena os dispositivos
  Zigbee/Thread/Z-Wave da casa (lâmpadas, tomadas, sensores). Ele roda o
  **Zigbee2MQTT** localmente, com interface web própria
  (`http://<ip-do-smhub>:8080` ou `http://smhub.local`).
- **Home Assistant (HA)**: o "cérebro" das automações. Se conecta ao SMHUB via
  MQTT e enxerga cada dispositivo Zigbee como uma entidade (`light.sala`,
  `sensor.porta_quarto`, etc). É onde ficam as regras ("se X, faça Y").
- **Bot de WhatsApp** (o que já existe neste repo): hoje fala com clientes da
  Felizcred. A ideia é ele também aceitar comandos de casa (ex: "acender sala")
  e chamar a API do HA — sem precisar instalar nenhuma integração nova dentro
  do Home Assistant.

## 2. Pra que vai servir

Dois objetivos, que não dependem um do outro:

1. **Controlar dispositivos pelo WhatsApp** — mandar "acender luz da sala" no
   número que você já usa e a luz acender, sem abrir o app do HA.
2. **Reduzir/corrigir os avisos de dispositivo "sumiu" (`unavailable`)** — hoje
   o HA só avisa que algo parou de responder. A ideia é o próprio HA tentar
   resolver sozinho antes de te avisar (ver seção 4), e a notificação final cair
   no WhatsApp já dizendo o que foi tentado, em vez do aviso cru do app.

## 3. Por que um dispositivo "para de parear" (fica `unavailable`)

Zigbee tem dois tipos de dispositivo:

- **Router** (tomadas/lâmpadas ligadas na energia) — além de funcionar,
  retransmite sinal de outros dispositivos pela casa (forma uma "mesh").
- **End device** (sensores a pilha) — dorme a maior parte do tempo pra economizar
  bateria e só fala com a rede de vez em quando.

Causas mais comuns de um dispositivo ficar `unavailable`:

1. **Interferência** — Wi-Fi 2.4GHz, micro-ondas, Bluetooth no mesmo canal.
2. **Buraco na mesh** — um router (repetidor) caiu, e quem dependia dele pra
   retransmitir perdeu o caminho até o hub.
3. **Coordenador do SMHUB engasgado** (raro, geralmente após update).
4. **Bateria fraca** num end device — ele não responde dentro do timeout.
5. Device realmente saiu de alcance ou foi resetado.

A notificação atual do HA é só "não recebi resposta a tempo" — ela avisa, mas
não tenta consertar nada sozinha.

## 4. Como corrigir automaticamente (plano técnico)

Isso fica dentro do **Home Assistant**, como uma automação local — não faz
sentido depender de mim (Claude) rodando em tempo real pra reagir, porque quem
precisa agir na hora é o HA/Zigbee2MQTT, que já está sempre ligado.

**Onde fica o comando "Reconfigure" (reinterrogar o dispositivo sem resetar):**

- **Pela interface do Z2M** (`http://<ip-do-smhub>:8080`): Devices → dispositivo
  → menu de ações → "Reconfigure".
- **Pelo HA**, se a entidade existir: `button.<nome_do_dispositivo>_reconfigure`
  (Configurações → Dispositivos e Serviços → MQTT → [device]).
- **Via serviço MQTT** (o que uma automação chama de fato), em
  Ferramentas de Desenvolvedor → Ações, serviço `mqtt.publish`:
  ```
  topic: zigbee2mqtt/bridge/request/device/configure
  payload: {"id": "nome_amigavel_do_device"}
  ```

**Lógica da automação a construir:**

1. Trigger: entidade fica `unavailable` por mais de X minutos.
2. Ação, em ordem crescente de agressividade:
   - Chamar "Reconfigure" no dispositivo (reinterroga sem resetar).
   - Se não resolver, abrir "permit join" por 60s (convida ele de volta pra
     rede) — só ajuda se o device caiu da rede, não se está com defeito.
   - Se continuar falhando depois de N tentativas, manda notificação final.
3. Notificação final sai pelo bot de WhatsApp (não pelo app do HA), já dizendo
   "tentei reconectar 2x e não consegui" em vez do aviso cru de hoje.

## 5. Como o WhatsApp vai controlar dispositivos

Não precisa instalar integração nova dentro do HA. No bot que já existe neste
repo, ao reconhecer um comando de casa (ex: "acender sala"), fazer um `POST`
pra API do HA:

```
POST http://<ip-do-ha>:8123/api/services/light/turn_on
Authorization: Bearer <long-lived-access-token>
Content-Type: application/json

{"entity_id": "light.sala"}
```

O token é gerado no próprio HA (Perfil → Segurança → Long-Lived Access Tokens).

## 6. O que falta decidir antes de codar

- Onde o HA está instalado hoje (Raspberry Pi, mini PC, dentro do SMHUB?) e se
  já está rodando.
- Se o HA é acessível só na rede local ou já tem acesso remoto (Nabu Casa,
  túnel, DuckDNS) — se for só local, eu (Claude) não consigo chamar a API
  diretamente daqui; preciso que você rode os testes ou exponha um jeito de eu
  acessar.
- Se a interface do Z2M/SMHUB já está habilitada e acessível.
- Nome/entity_id real dos dispositivos que mais dão problema de `unavailable`
  hoje, pra montar a automação em cima deles primeiro.
