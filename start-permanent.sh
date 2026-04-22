#!/bin/bash

# 🎮 Iniciar Dados Tic-Tac-Toe com túnel rápido (trycloudflare.com)
# Não precisa de conta, funciona imediatamente

echo "🎮 Iniciando Dados Tic-Tac-Toe com túnel rápido..."

# Inicia o servidor
echo "🚀 Iniciando servidor na porta 3001..."
cd /root/.nanobot/workspace/dados-tictactoe
nohup node server.js > server.log 2>&1 &
SERVER_PID=$!

# Aguarda servidor iniciar
echo "⏳ Aguardando servidor..."
for i in {1..30}; do
    if grep -q "Ready on" server.log 2>/dev/null; then
        echo "✅ Servidor iniciado!"
        break
    fi
    sleep 1
done

# Inicia o túnel rápido
echo "🌐 Iniciando túnel rápido (trycloudflare.com)..."
cloudflared tunnel --url http://localhost:3001 > tunnel.log 2>&1 &
TUNNEL_PID=$!

echo ""
echo "═══════════════════════════════════════════════════"
echo "  🎉 SERVIDOR INICIADO COM TÚNEL RÁPIDO!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  📝 Logs:"
echo "     - Servidor: tail -f server.log"
echo "     - Túnel:    tail -f tunnel.log"
echo ""
echo "  🛑 Para parar: ./stop-tunnel.sh"
echo "═══════════════════════════════════════════════════"
echo ""

# Salva PIDs
echo "$SERVER_PID" > server.pid
echo "$TUNNEL_PID" > tunnel.pid
