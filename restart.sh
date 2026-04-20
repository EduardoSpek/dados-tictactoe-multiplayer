#!/bin/bash
# Script rápido para reiniciar o servidor do jogo

echo "🎮 Reiniciando servidor Dados Tic-Tac-Toe..."

# Mata o servidor atual (se estiver rodando)
pkill -f "node server.js" 2>/dev/null

# Aguarda liberar a porta
sleep 1

# Limpa o log anterior
> server.log

# Inicia o servidor em background
nohup node server.js > server.log 2>&1 &

# Aguarda inicialização
sleep 2

# Verifica se subiu
if pgrep -f "node server.js" > /dev/null; then
    echo "✅ Servidor iniciado em http://localhost:3001"
    echo "📋 Últimas linhas do log:"
    tail -5 server.log
else
    echo "❌ Falha ao iniciar servidor. Verifique server.log"
fi
