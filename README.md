# 🎲 Dados Tic-Tac-Toe Multiplayer

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-white?style=flat-square&logo=socket.io)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

> **Jogo da Velha com Dados - Versão Multiplayer Online**

Um jogo da velha inovador com mecânicas de dados, dois tabuleiros simultâneos e sistema de "roubo" de casas. Jogue online com amigos em tempo real!

![Game Preview](https://img.shields.io/badge/🎮-Jogue%20Agora-brightgreen?style=for-the-badge)

---

## ✨ Funcionalidades

### 🎯 Mecânicas do Jogo
- **🎲 Sistema de Dados**: Role um dado (0-8) para determinar em qual coluna jogar
- **🔥 Modo Roubo (0)**: Ao tirar **0**, entre no modo roubo e capture casas do adversário!
- **🧹 Modo Limpar (7)**: Ao tirar **7**, escolha qual tabuleiro limpar completamente!
- **🎭 Modo Inversão (8)**: Ao tirar **8**, inverte todas as marcas (X vira O e vice-versa)!
- **🎲 Dado Justo**: Todos os números têm igual probabilidade de sair
- **🔄 Silently Reroll**: Modos inválidos são rerolados automaticamente (sem mostrar ao jogador)
- **🎯 Letras nos Dados**: Modos especiais exibem iniciais (R=0, L=7, I=8)
- **🎨 Dado Vazado**: Dados com bordas brancas e bolinhas vermelhas
- **🎭 Dois Tabuleiros**: Tabuleiros 1-3 e 4-6 com colunas interconectadas
- **🏆 Placar de Vitórias**: Acompanhe seu desempenho contra oponentes
- **🔄 Reconexão Automática**: Volte ao jogo mesmo se atualizar a página
- **✨ Indicador de Vez**: Borda glow amarela pulsante quando é sua vez de jogar
- **😀 Reações com Emoji**: Comunique-se com oponente usando emojis (feliz, triste, raiva, risada, descolado)
- **⏱️ Timer de Turno**: 15 segundos para jogar, caso expire a vez passa automaticamente
- **🔊 Som de Turno Perdido**: Alerta sonoro quando o timer expira e a vez passa

### 💰 Sistema de Moedas e Compras
- **🪙 Ganhe Moedas**: Receba 1 moeda ao vencer uma rodada
- **💎 Sequência de Vitórias**: Acumule bônus com vitórias consecutivas (streak)
- **🛒 Compre Modos Especiais**: Use moedas para ativar poderes:
  - **Limpar Tabuleiro (1 moeda)**: Limpe todas as casas do oponente em um tabuleiro
  - **Restaurar Tabuleiro (2 moedas)**: Restaure o tabuleiro que foi limpo pelo oponente
- **🔄 Cancelar Compra**: Cancele um modo comprado antes de usar

### 🌐 Multiplayer Online
- **Crie Salas**: Gere códigos de sala para convidar amigos
- **Código na Área de Transferência**: Ao criar sala, o código é copiado automaticamente
- **Conexão Automática**: Dois jogadores no mesmo link se conectam automaticamente
- **Entre por Código**: Conecte-se a salas existentes facilmente
- **Tempo Real**: Comunicação instantânea via WebSocket
- **Suporte a Rede Local**: Jogue na mesma rede WiFi

### 🎨 Interface
- **🌙 Modo Escuro**: Interface elegante com tema dark
- **📱 Responsivo**: Funciona em desktop, tablet e mobile
- **🔊 Efeitos Sonoros**: Sons imersivos para cada ação (dado, roubo, limpar, vitória)
- **✨ Indicador Visual de Vez**: Borda glow pulsante quando é sua vez
- **😀 Reações com Emoji**: Botão de reações ao lado do dado para interagir com oponente
- **⚡ Animações Suaves**: Transições fluidas e modernas

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js 20+
- npm ou yarn

### Instalação

```bash
# Clone o repositório
git clone https://github.com/EduardoSpek/dados-tictactoe-multiplayer.git

# Entre na pasta
cd dados-tictactoe-multiplayer

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

O servidor estará disponível em `http://localhost:3001`

### 🌐 Jogar na Rede Local

Para jogar com amigos na mesma rede:

1. Descubra seu IP local:
   ```bash
   # Linux/Mac
   ip addr show
   
   # Windows
   ipconfig
   ```

2. Compartilhe o endereço: `http://SEU_IP:3001`

3. Seus amigos acessam pelo navegador e jogam em tempo real!

---

## 🎮 Como Jogar

### Criar uma Sala
1. Acesse a página inicial
2. Digite seu nome
3. Clique em "Criar Sala"
4. Compartilhe o código da sala com seu amigo

### Entrar em uma Sala
1. Digite seu nome
2. Cole o código da sala
3. Clique em "Entrar na Sala"

### Regras do Jogo
1. **Role o dado** para sortear uma coluna (1-6)
2. **Marque** em uma das casas da coluna sorteada
3. **Tire 0** para ativar o modo roubo (R) e capturar casas do adversário
4. **Tire 7** para ativar o modo limpar (L) e zerar um tabuleiro completo
5. **Tire 8** para ativar o modo inversão (I) e inverter todas as marcas
6. **Use emojis** para se comunicar com seu oponente durante a partida
7. **Alinhe 3** em qualquer tabuleiro para vencer!

---

## 🛠️ Tecnologias

- **[Next.js](https://nextjs.org/)** - Framework React com App Router
- **[Socket.io](https://socket.io/)** - Comunicação em tempo real
- **[TypeScript](https://www.typescriptlang.org/)** - Tipagem estática
- **[Tailwind CSS](https://tailwindcss.com/)** - Estilização utilitária
- **[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)** - Efeitos sonoros

---

## 📁 Estrutura do Projeto

```
dados-tictactoe-multiplayer/
├── server.js              # Servidor Socket.io
├── src/
│   ├── app/
│   │   ├── game/          # Página do jogo multiplayer
│   │   ├── lobby/         # Página de criação/entrada de salas
│   │   ├── offline/       # Modo offline (vs IA)
│   │   └── api/socket/    # Configuração do Socket.io
│   ├── components/        # Componentes React
│   └── hooks/
│       └── useSocket.ts   # Hook de conexão WebSocket
├── public/               # Assets estáticos
└── package.json
```

---

## 📝 Notas

- **⚠️ Não suporta Vercel**: Este projeto requer um servidor WebSocket persistente, não compatível com serverless.
- **💾 Persistência**: O placar é mantido durante a sessão da sala.
- **🔄 Reconexão**: Jogadores podem reconectar em até 30 segundos após desconectar.

---

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

---

## 📜 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

---

<div align="center">

### 💜 Desenvolvido com amor por **Eduardo Spek**

[![Instagram](https://img.shields.io/badge/Instagram-%40eduardospek-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/eduardospek)
[![GitHub](https://img.shields.io/badge/GitHub-EduardoSpek-181717?style=for-the-badge&logo=github)](https://github.com/EduardoSpek)

</div>

---

<p align="center">
  <strong>🎲 Divirta-se jogando! 🎮</strong>
</p>
