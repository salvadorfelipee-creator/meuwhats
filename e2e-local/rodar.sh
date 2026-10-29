#!/bin/bash
# Varredura ponta a ponta do fluxo do cliente, 100% local: banco SQLite próprio + Facta/Unnotech simuladas (mocks.js).
# Não toca produção nem manda WhatsApp. Uso (na raiz do repo): bash e2e-local/rodar.sh
#   - sem variável: roda os dois testes em sequência, cada um com servidor e banco novos
#       driver-unno-primeiro.js = fluxo atual (Unnotech na frente, Facta em paralelo)
#       driver.js               = cenários que valem nos dois caminhos (Facta negativa, chat antes do formulário...)
#   - DRIVER=driver-unno-primeiro.js bash e2e-local/rodar.sh  roda só um deles.
# Limite: sem GEMINI_API_KEY local, a parte generativa do chat não é exercitada (só as respostas fixas).
DIR="$(cd "$(dirname "$0")" && pwd -W 2>/dev/null || pwd)"; RAIZ="$DIR/.."
cd "$RAIZ"
rodar_um() {
  rm -f "$DIR/e2e.db"*
  env -i PATH="$PATH" SYSTEMROOT="$SYSTEMROOT" TEMP="$TEMP" PORT=3000 TURSO_DATABASE_URL="file:$DIR/e2e.db" \
    FACTA_BRIDGE_URL=http://127.0.0.1:4101 FACTA_BRIDGE_SECRET=x UNNOTECH_CLIENT_ID=x UNNOTECH_CLIENT_SECRET=x UNNOTECH_USER_UUID=u1 UNNO_ESPERA_COTACOES_MS=4000 \
    PAINEL_USER=admin PAINEL_PASS=admin node -r "$DIR/mocks.js" server.js > "$DIR/server.log" 2>&1 &
  PID=$!; sleep 12; echo "=== $1 ==="; node "$DIR/$1"; [ -n "$MANTER" ] || kill $PID; sleep 2
}
if [ -n "$DRIVER" ]; then rodar_um "$DRIVER"; else rodar_um driver-unno-primeiro.js; rodar_um driver.js; fi
