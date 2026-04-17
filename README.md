# 🎲 Jogo da Velha com Dados

Um jogo da velha estratégico com mecânica de dados, desenvolvido com Next.js, TypeScript e Tailwind CSS.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?style=flat-square&logo=tailwind-css)

## 🎮 Como Jogar

1. **Role o dado** clicando nele para sortear um número de 1 a 6
2. **Números 1, 2, 3** → marque no **tabuleiro esquerdo** (colunas correspondentes)
3. **Números 4, 5, 6** → marque no **tabuleiro direito** (colunas correspondentes)
4. Se a coluna sorteada estiver **cheia**, a vez passa automaticamente para o outro jogador
5. Faça **3 em linha** (horizontal, vertical ou diagonal) para vencer!

## ✨ Funcionalidades

- 🎲 Dois tabuleiros 3x3 com mecânica de dados
- 🌙 Tema claro/escuro com persistência
- 📱 Design responsivo para mobile e desktop
- 🏆 Placar persistente no LocalStorage
- ⚡ Animações suaves no dado
- 🔄 Reinício de jogo e zeramento de placar

## 🛠️ Tecnologias

- **Next.js 14** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização utilitária
- **Lucide React** - Ícones modernos

## 🚀 Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/dados-tictactoe.git
cd dados-tictactoe

# Instale as dependências
npm install

# Execute em modo desenvolvimento
npm run dev

# Acesse http://localhost:3001
```

## 📦 Build para Produção

```bash
npm run build
npm start
```

## 🎯 Regras do Jogo

- Dois jogadores alternam turnos (X e O)
- Cada turno começa rolando o dado
- O número sorteado determina em qual coluna o jogador deve marcar
- Se a coluna estiver completamente preenchida, o jogador perde a vez
- Vitória: 3 símbolos iguais em linha (horizontal, vertical ou diagonal) em qualquer tabuleiro

## 📱 Screenshots

*Adicione screenshots do jogo aqui*

## 📝 Licença

MIT License - sinta-se livre para usar e modificar!

---

Desenvolvido com ❤️ por **Eduardo Spek**

[![Instagram](https://img.shields.io/badge/Instagram-%40eduardospek-E4405F?style=flat-square&logo=instagram&logoColor=white)](https://www.instagram.com/eduardospek)
