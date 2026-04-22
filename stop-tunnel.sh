#!/bin/bash

# 🛑 Para o servidor e o túnel

echo "🛑 Parando Dados Tic-Tac-Toe..."

# Para o túnel
if [ -f tunnel.pid ]; then
    TUNNEL_PID=$(cat tunnel.pid)
    if kill $TUNNEL_PID 2>/dev/null; then
        echo "✅ Túnel parado"
    fi
    rm -f tunnel.pid
fi

# Para o servidor
if [ -f server.pid ]; then
    SERVER_PID=$(cat server.pid)
    if kill $SERVER_PID 2>/dev/null; then
        echo "✅ Servidor parado"
    fi
    rm -f server.pid
fi

# Limpa processos órfãos
pkill -f "cloudflared tunnel" 2>/dev/null
pkill -f "node server.js" 2>/dev/null

echo "✅ Tudo parado!"
