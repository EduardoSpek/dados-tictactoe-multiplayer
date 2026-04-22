#!/bin/bash

# 🎮 Dados Tic-Tac-Toe - Túnel Permanente
# Configura um túnel fixo usando Cloudflare Tunnel

echo "🎮 Configurando túnel permanente..."

# Verifica se cloudflared está instalado
if ! command -v cloudflared &> /dev/null; then
    echo "❌ Cloudflared não encontrado!"
    exit 1
fi

# Cria diretório de configuração
mkdir -p ~/.cloudflared

# Cria arquivo de configuração para túnel permanente
cat > ~/.cloudflared/config.yml <<EOF
tunnel: $(cat /dev/urandom | tr -dc 'a-z' | head -c 16)
credentials-file: ~/.cloudflared/$(cat /dev/urandom | tr -dc 'a-z0-9' | head -c 16).json
ingress:
  - hostname: dados-tictactoe.spek.games
    service: http://localhost:3001
  - service: http_status:404
EOF

echo "✅ Túnel configurado!"
echo ""
echo "📝 Para iniciar o túnel permanentemente, execute:"
echo "   cloudflared tunnel --config ~/.cloudflared/config.yml"
echo ""
echo "💡 Dica: Pode adicionar isso ao seu .bashrc ou criar um serviço systemd"
