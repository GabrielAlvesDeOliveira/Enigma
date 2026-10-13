# Sala de Enigmas Online

Projeto de extensão da disciplina **Certificadora de Competências 2** (Engenharia de Computação, UTFPR Campus Cornélio Procópio). A aplicação leva a experiência de escape room do programa de extensão **LUDICO** para o formato online: um grupo resolve enigmas em conjunto, dentro de um tempo limite, com um mestre acompanhando a sala.

- Programa LUDICO: https://utfprbg.cp.utfpr.edu.br/index.php/sobre/
- Projeto Escape Room (Keyscape): https://escaperoom.cp.utfpr.edu.br/

## Equipe

- Gabriel
- Maria Júlia
- José
- João

## Como funciona

- O **mestre** (usuário admin) cria a sala e o sistema gera um **código de 6 caracteres**.
- Até **3 jogadores** entram pelo código. Eles aguardam até o mestre iniciar o cronômetro. Depois do início, não entram novos jogadores.
- A partida dura **40 minutos fixos**, controlados pelo servidor.
- São **3 enigmas fixos**, iguais para todos os jogadores (proposta inicial: cifra, sequência lógica e busca em grafo/labirinto). Podem ser resolvidos ao mesmo tempo por jogadores diferentes. Quando um enigma é resolvido, ele fica bloqueado para todos.
- A sala funciona com 1, 2 ou 3 jogadores.
- O mestre acompanha o progresso em um painel separado, em tempo real.
- Existe histórico de sessões: o jogador vê apenas as suas, o admin vê todas e pode filtrar (por exemplo, as que ele guiou).
- A comunicação entre os jogadores é externa (chamada de voz).

## Tecnologias

| Parte | Tecnologia |
|---|---|
| Backend | Node.js 24 (LTS), Express, arquitetura MVC com routes e services |
| Banco de dados | PostgreSQL, migrations e seeds com Knex |
| Autenticação | E-mail e senha, senha com hash (bcryptjs), token JWT |
| Tempo real (planejado) | Socket.IO |
| Frontend (planejado) | React com Vite |

## Pré-requisitos

- Node.js 24 (LTS) e npm 11
- PostgreSQL (toda a equipe deve usar a mesma versão principal; registrar aqui a versão adotada)
- Git

Confira com `node -v` e `npm -v`.

## Estrutura do repositório

```
Enigma/
├── backend/
│   ├── src/
│   │   ├── config/          conexão com o banco e configurações
│   │   ├── controllers/     recebem a requisição e devolvem a resposta
│   │   ├── database/
│   │   │   ├── migrations/  criação e alteração das tabelas
│   │   │   └── seeds/       dados iniciais (usuário admin)
│   │   ├── middlewares/     autenticação, permissão de admin, erros
│   │   ├── models/          acesso aos dados de cada entidade
│   │   ├── routes/          mapa das URLs da API
│   │   ├── services/        regras de negócio (sala, cronômetro, progresso)
│   │   │   └── algorithms/  algoritmos dos enigmas (cifra, sequência, grafo)
│   │   ├── sockets/         comunicação em tempo real
│   │   ├── app.js           monta o Express
│   │   └── server.js        sobe o servidor
│   ├── knexfile.js
│   ├── .env.example
│   └── package.json
├── frontend/                (React, a ser criado)
├── .gitignore
└── README.md
```

## Como rodar o backend

1. Clone o repositório e entre na pasta do backend:
   ```
   git clone <url-do-repositorio>
   cd Enigma/backend
   ```
2. Instale as dependências:
   ```
   npm install
   ```
3. Crie o arquivo `.env` a partir do exemplo e preencha os valores:
   ```
   copy .env.example .env
   ```
   (no PowerShell: `Copy-Item .env.example .env`)
4. Crie o banco de dados. No **SQL Shell (psql)**:
   ```
   CREATE DATABASE enigma_dev;
   ```
5. Crie as tabelas:
   ```
   npm run migrate
   ```
6. Crie o usuário mestre (admin) inicial:
   ```
   npm run seed
   ```
7. Suba o servidor em modo de desenvolvimento:
   ```
   npm run dev
   ```
8. Teste em `http://localhost:3000/health`. A resposta esperada é `{"status":"ok"}`.

### Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `PORT` | Porta da API (padrão 3000) |
| `DB_HOST` | Servidor do banco (localhost) |
| `DB_PORT` | Porta do PostgreSQL (5432) |
| `DB_USER` | Usuário do banco |
| `DB_PASSWORD` | Senha do banco |
| `DB_NAME` | Nome do banco (enigma_dev) |
| `JWT_SECRET` | Segredo usado para assinar os tokens de login |
| `ADMIN_NAME` | Nome do usuário mestre criado pelo seed |
| `ADMIN_EMAIL` | E-mail do usuário mestre |
| `ADMIN_PASSWORD` | Senha do usuário mestre |

O arquivo `.env` nunca vai para o Git. Apenas o `.env.example`, sem valores reais.

### Scripts do backend

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor com reinício automático |
| `npm run migrate` | Aplica as migrations pendentes |
| `npm run migrate:rollback` | Desfaz o último lote de migrations |
| `npm run seed` | Executa os seeds (cria o admin) |

## Banco de dados

| Tabela | Conteúdo |
|---|---|
| `users` | Usuários, com papel de jogador ou admin |
| `rooms` | Salas (cada sala é uma sessão): código, mestre, status, horários |
| `room_players` | Jogadores de cada sala |
| `room_puzzle_progress` | Situação de cada enigma em cada sala (aberto ou resolvido) |
| `puzzle_attempts` | Cada tentativa de resposta, usada no painel do mestre e no histórico |

O conteúdo dos enigmas fica no código (`services/`). O banco guarda apenas o progresso e as tentativas.

### Regras para migrations

- Nunca edite uma migration que já foi enviada ao GitHub. Para mudar algo, crie uma migration nova.
- Crie migrations com `npx knex migrate:make nome_da_mudanca`.
- Depois de atualizar o código (`git pull`), rode `npm run migrate`.

## Fluxo de trabalho no Git

- A branch `main` deve estar sempre funcionando.
- Cada tarefa é feita em uma branch própria (por exemplo, `feat/login`) e entra na `main` por pull request.
- Commits curtos e com mensagens claras.

## Status do projeto

- [x] Estrutura inicial do backend (Express, MVC, routes e services)
- [x] Configuração do Knex e do PostgreSQL
- [x] Migrations das 5 tabelas
- [x] Seed do usuário admin
- [ ] Autenticação (cadastro, login, middlewares)
- [ ] Salas (criar, entrar, iniciar, cronômetro)
- [ ] Enigmas e algoritmos
- [ ] Histórico e painel do mestre (Socket.IO)
- [ ] Contrato da API em `docs/API.md`
- [ ] Frontend em React
- [ ] Deploy em hospedagem gratuita