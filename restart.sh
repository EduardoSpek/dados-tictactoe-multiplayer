#!/bin/bash
cd /root/.nanobot/workspace/dados-tictactoe-multiplayer
pkill -f "node server.js" 2>/dev/null
sleep 1
nohup node server.js > server.log 2>&1 &
sleep 1
echo "Servidor iniciado!"