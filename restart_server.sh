#!/bin/bash
# Restart script for dados-tictactoe-multiplayer server

cd /root/.nanobot/workspace/dados-tictactoe-multiplayer

# Kill existing server
pkill -f "node server" 2>/dev/null
sleep 1

# Start server
node server.js > /tmp/server.log 2>&1 &
sleep 2

# Check if running
if ps aux | grep "node server.js" | grep -v grep > /dev/null; then
    echo "✅ Server started!"
    tail -5 /tmp/server.log
else
    echo "❌ Server failed to start"
    cat /tmp/server.log
fi