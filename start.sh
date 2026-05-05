#!/bin/bash

# Check if server is already running
if pgrep -f "node server.js" > /dev/null; then
    echo "✅ Servidor já está rodando na porta 3001"
    exit 0
fi

# Check if port 3001 is in use
if ss -tlnp 2>/dev/null | grep -q ":3001" || netstat -tlnp 2>/dev/null | grep -q ":3001"; then
    echo "⚠️ Porta 3001 em uso, matando processo..."
    fuser -k 3001/tcp 2>/dev/null
    sleep 1
fi

# Start server
cd "$(dirname "$0")"
nohup npm run dev > server.log 2>&1 &
sleep 2

# Check if started
if pgrep -f "node server.js" > /dev/null; then
    echo "✅ Servidor iniciado com sucesso!"
    echo "🌐 Acesse: http://localhost:3001"
else
    echo "❌ Erro ao iniciar servidor"
    tail -5 server.log
fi