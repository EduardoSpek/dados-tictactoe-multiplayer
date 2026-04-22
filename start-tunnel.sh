#!/bin/bash

# 🎮 Dados Tic-Tac-Toe + Cloudflare Tunnel
# Script para iniciar servidor com túnel reverso

echo "🎮 Iniciando Dados Tic-Tac-Toe com Cloudflare Tunnel..."
echo ""

# Verifica se o servidor já está rodando
if pgrep -f "node server.js" > /dev/null; then
    echo "⚠️  Servidor já está rodando!"
    echo "🔄 Parando servidor anterior..."
    pkill -f "node server.js"
    sleep 2
fi

# Verifica se cloudflared está instalado
if ! command -v cloudflared &> /dev/null; then
    echo "❌ Cloudflared não encontrado!"
    echo "📥 Instalando..."
    curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
    dpkg -x /tmp/cloudflared.deb /tmp/cf
    cp /tmp/cf/usr/bin/cloudflared /usr/local/bin/
    chmod +x /usr/local/bin/cloudflared
fi

# Limpa logs antigos
> server.log
> tunnel.log

echo "🚀 Iniciando servidor na porta 3001..."
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

echo ""
echo "🌐 Iniciando Cloudflare Tunnel..."
echo "⏳ Isso pode levar alguns segundos..."
echo ""

# Inicia o túnel em background e captura a URL
cloudflared tunnel --url http://localhost:3001 2>&1 | tee tunnel.log &
TUNNEL_PID=$!

# Aguarda o túnel criar a URL
echo "🔄 Criando túnel seguro..."
for i in {1..60}; do
    URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" tunnel.log | head -1)
    if [ ! -z "$URL" ]; then
        echo ""
        echo "═══════════════════════════════════════════════════"
        echo "  🎉 TÚNEL CRIADO COM SUCESSO!"
        echo "═══════════════════════════════════════════════════"
        echo ""
        echo "  🌐 URL PÚBLICA:"
        echo "     $URL"
        echo ""
        echo "  📱 Compartilhe com seu filho!"
        echo "     Ele pode acessar de qualquer lugar!"
        echo ""
        echo "  🏠 Local: http://localhost:3001"
        echo "═══════════════════════════════════════════════════"
        echo ""
        echo "📝 Logs:"
        echo "   - Servidor: tail -f server.log"
        echo "   - Túnel:    tail -f tunnel.log"
        echo ""
        echo "🛑 Para parar: ./stop-tunnel.sh"
        echo ""
        
        # Salva a URL e PIDs
        echo "$URL" > tunnel.url
        echo "$SERVER_PID" > server.pid
        echo "$TUNNEL_PID" > tunnel.pid
        
        exit 0
    fi
    sleep 1
done

echo "❌ Erro: Não foi possível criar o túnel"
echo "Verifique tunnel.log para mais detalhes"
kill $SERVER_PID $TUNNEL_PID 2>/dev/null
exit 1
