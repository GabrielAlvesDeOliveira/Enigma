# API da Sala de Enigmas Online

Este documento é o contrato entre o backend e o frontend. Ele foi escrito a partir do código e os exemplos são respostas reais da API (capturadas executando um cenário completo). O teste `backend/tests/apiDocs.test.js` confere que todo endpoint documentado existe e que a quantidade de endpoints documentados bate com a do código, então a documentação não fica para trás sem ninguém perceber.

## 1. Convenções

| Item | Regra |
|---|---|
| Endereço base | `http://localhost:3000` em desenvolvimento. Os dados ficam em `/api/...` |
| Formato | JSON nas requisições (`Content-Type: application/json`) e nas respostas |
| Autenticação | Cabeçalho `Authorization: Bearer <token>`. O token vem de `register` ou `login` e vale 8 horas |
| Papéis | `player` (jogador) e `admin` (mestre). Quem se cadastra pela API é sempre `player`. O primeiro mestre vem do seed |
| Erros | Sempre `{ "error": "mensagem em português" }` com o código HTTP adequado |
| Datas | ISO 8601 em UTC, por exemplo `2026-10-15T01:12:04.634Z`. As tentativas de resposta têm precisão de segundos |
| Durações | Em milissegundos (`remainingMs`, `timeSpentMs`, `durationMs`) |
| Ids | Números inteiros |
| Código da sala | 6 caracteres, sem 0, O, 1, I e L. Aceita minúsculas e espaços nas pontas |

### Códigos de erro

| Código | Quando |
|---|---|
| 400 | Dados ausentes ou inválidos (corpo, parâmetros da URL, código de sala) |
| 401 | Sem token, token inválido ou expirado |
| 403 | Logado, mas sem permissão para a ação |
| 404 | Recurso inexistente. Também para salas que o jogador não pode ver, para não revelar quais existem |
| 409 | A ação não é possível no estado atual (sala cheia, sala já iniciada, enigma já resolvido, tempo acabou) |
| 429 | Só no tempo real: inscrições demais em salas |
| 500 | Erro interno |

Exemplo de erro:

```json
{
  "error": "Apenas o mestre pode fazer isso."
}
```

### Valores fixos

| Campo | Valores |
|---|---|
| `status` da sala | `waiting` (aguardando), `in_progress` (em andamento), `finished` (encerrada) |
| `finishReason` | `null` enquanto não terminou, `completed` (3 enigmas resolvidos), `timeout` (tempo esgotado), `cancelled` (cancelada pelo mestre) |
| `status` do enigma | `open` (aberto), `solved` (resolvido) |
| `key` do enigma | `cipher` (cifra), `sequence` (sequência), `maze` (labirinto) |

## 2. Resumo dos endpoints

| Método | Rota | Quem | O que faz |
|---|---|---|---|
| GET | `/health` | Público | Confere se a API está no ar |
| POST | `/api/auth/register` | Público | Cadastra um jogador |
| POST | `/api/auth/login` | Público | Entra e recebe o token |
| GET | `/api/auth/me` | Logado | Dados do usuário logado |
| POST | `/api/rooms` | Mestre | Cria uma sala |
| POST | `/api/rooms/join` | Jogador | Entra em uma sala pelo código |
| GET | `/api/rooms/mine` | Jogador | Histórico das sessões do jogador |
| GET | `/api/rooms/:id` | Membro da sala ou mestre | Estado da sala |
| POST | `/api/rooms/:id/start` | Mestre dono da sala | Inicia o cronômetro |
| POST | `/api/rooms/:id/cancel` | Mestre dono da sala | Cancela a sala |
| POST | `/api/rooms/:id/leave` | Jogador da sala | Sai da sala (só enquanto aguarda) |
| GET | `/api/rooms/:id/puzzles` | Membro da sala ou mestre | Lista os 3 enigmas com o status |
| GET | `/api/rooms/:id/puzzles/:key` | Membro da sala (em andamento) ou mestre | Conteúdo de um enigma |
| POST | `/api/rooms/:id/puzzles/:key/answer` | Jogador da sala | Envia a resposta de um enigma |
| GET | `/api/admin/rooms` | Mestre | Todas as sessões, com filtros |
| GET | `/api/admin/rooms/:id` | Mestre | Painel da sala: resumo e tentativas |

Além disso, há o canal em tempo real (Socket.IO), descrito na seção 8.

## 3. Objetos

### 3.1 Usuário

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | número | Identificador |
| `name` | texto | Nome de exibição |
| `email` | texto | E-mail (sempre em minúsculas) |
| `role` | texto | `player` ou `admin` |
| `createdAt` | texto | Data de criação (ISO 8601 UTC) |

A senha nunca é devolvida.

### 3.2 Estado da sala

É o objeto devolvido por quase todas as rotas de sala e enviado a todos pelo tempo real. Ele é igual para jogadores e mestre.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | número | Identificador da sala |
| `code` | texto | Código de entrada (6 caracteres) |
| `status` | texto | `waiting`, `in_progress` ou `finished` |
| `finishReason` | texto ou null | `completed`, `timeout` ou `cancelled` |
| `durationMs` | número | Duração total da partida (2.400.000 ms, ou seja, 40 minutos) |
| `startedAt` | texto ou null | Quando o mestre iniciou |
| `endsAt` | texto ou null | Fim previsto (início mais 40 minutos) |
| `finishedAt` | texto ou null | Quando terminou de fato |
| `remainingMs` | número | Tempo restante. Aguardando mostra a duração cheia. Encerrada mostra 0 |
| `serverNow` | número | Relógio do servidor em ms (para acertar o cronômetro, ver seção 9) |
| `master` | objeto | `{ id, name }` do mestre que criou a sala |
| `players` | lista | `{ id, name }` de cada jogador, na ordem de entrada |
| `puzzles` | lista | Um item por enigma: `{ key, status, solvedBy, solvedAt }`. `solvedBy` é o id do jogador |

```json
{
  "room": {
    "id": 1,
    "code": "NMTU2B",
    "status": "waiting",
    "finishReason": null,
    "durationMs": 2400000,
    "startedAt": null,
    "endsAt": null,
    "finishedAt": null,
    "remainingMs": 2400000,
    "serverNow": 1792081587707,
    "master": {
      "id": 1,
      "name": "Mestre Paulo"
    },
    "players": [],
    "puzzles": [
      {
        "key": "cipher",
        "status": "open",
        "solvedBy": null,
        "solvedAt": null
      },
      {
        "key": "sequence",
        "status": "open",
        "solvedBy": null,
        "solvedAt": null
      },
      {
        "key": "maze",
        "status": "open",
        "solvedBy": null,
        "solvedAt": null
      }
    ]
  }
}
```

### 3.3 Enigma

Na lista (`GET .../puzzles`), cada item tem `key`, `title`, `status`, `solvedBy` e `solvedAt`. No conteúdo (`GET .../puzzles/:key`), vêm também os dados do enigma, que variam por tipo. **A resposta correta nunca é enviada.**

| `key` | Campos extras | Formato da resposta (`answer`) |
|---|---|---|
| `cipher` | `statement`, `encryptedText` | Texto com a mensagem decifrada. Ignora maiúsculas, acentos e espaços extras |
| `sequence` | `statement`, `terms` (lista de números) | O próximo número, como número ou texto numérico |
| `maze` | `statement`, `start`, `end`, `edges` (pares de salas conectadas) | Lista com os nomes das salas do caminho, da entrada até a saída |

### 3.4 Tentativa de resposta

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | número | Identificador |
| `puzzleKey` | texto | Enigma tentado |
| `user` | objeto | `{ id, name }` de quem enviou |
| `answer` | qualquer | Exatamente o que o jogador enviou |
| `isCorrect` | booleano | Se acertou |
| `createdAt` | texto | Quando enviou (precisão de segundos) |

## 4. Saúde e autenticação

### `GET /health`

Público. Devolve `{ "status": "ok" }` com código 200.

### `POST /api/auth/register`

Público. Cria um jogador e já devolve o token.

Corpo: `{ "name": "Ana", "email": "ana@exemplo.com", "password": "senha12345" }`

Regras: nome de 2 a 80 caracteres, e-mail válido, senha de 8 a 72 caracteres.

Resposta 201:

```json
{
  "user": {
    "id": 2,
    "name": "Ana",
    "email": "ana@exemplo.com",
    "role": "player",
    "createdAt": "2026-10-15T16:26:27.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Erros:

| Código | Mensagem |
|---|---|
| 400 | `Informe nome, e-mail e senha.` |
| 400 | `O nome deve ter entre 2 e 80 caracteres.` |
| 400 | `E-mail inválido.` |
| 400 | `A senha deve ter entre 8 e 72 caracteres.` |
| 409 | `Este e-mail já está cadastrado.` |

### `POST /api/auth/login`

Público. Corpo: `{ "email": "...", "password": "..." }`. A resposta tem o mesmo formato do cadastro (`user` e `token`), com código 200.

Erros:

| Código | Mensagem |
|---|---|
| 400 | `Informe e-mail e senha.` |
| 401 | `E-mail ou senha inválidos.` (a mesma mensagem para senha errada e e-mail inexistente) |

### `GET /api/auth/me`

Logado. Devolve `{ "user": { ... } }` com o usuário do token. Útil para restaurar a sessão ao recarregar a página.

Erros: 401 com `Faça login para continuar.`, `Token inválido ou expirado.` ou `Usuário não encontrado.`

## 5. Salas

### `POST /api/rooms`

Mestre. Cria uma sala aguardando, com o código gerado pelo servidor e os 3 enigmas abertos. Sem corpo. Resposta 201: `{ "room": <estado da sala> }` (exemplo na seção 3.2).

Erros: 401, 403 (`Apenas o mestre pode fazer isso.`).

### `POST /api/rooms/join`

Jogador. Entra pelo código. Repetir o pedido de quem já é membro é permitido (serve para voltar à sala) e não gera aviso em tempo real.

Corpo: `{ "code": "pv8a39" }`

Resposta 200:

```json
{
  "room": "<estado da sala, ver seção 3.2>"
}
```

Erros:

| Código | Mensagem |
|---|---|
| 400 | `Código inválido.` |
| 403 | `Apenas jogadores entram em uma sala pelo código.` |
| 404 | `Sala não encontrada.` |
| 409 | `Esta sala já foi iniciada ou encerrada.` (não há entrada depois do início) |
| 409 | `A sala está cheia.` (no máximo 3 jogadores) |

### Histórico do jogador

A rota é `GET /api/rooms/mine` e está descrita na seção 7, junto com os filtros, a paginação e o formato da resposta.

### `GET /api/rooms/:id`

Membro da sala ou qualquer mestre. Devolve `{ "room": <estado da sala> }`. Se o tempo já tinha acabado, a sala é encerrada nesta consulta.

Erros: 401, 404 (`Sala não encontrada.`, inclusive para quem não é da sala).

### `POST /api/rooms/:id/start`

Mestre que criou a sala. Inicia o cronômetro de 40 minutos. Os jogadores já na sala passam a poder ver e responder os enigmas.

Resposta 200: `{ "room": <estado da sala> }` com `status` igual a `in_progress` e `startedAt` e `endsAt` preenchidos.

Erros:

| Código | Mensagem |
|---|---|
| 403 | `Apenas o mestre pode fazer isso.` (jogador) ou `Apenas o mestre que criou a sala pode iniciá-la.` |
| 404 | `Sala não encontrada.` |
| 409 | `Esta sala já foi iniciada ou encerrada.` |
| 409 | `Aguarde pelo menos um jogador entrar.` |

### `POST /api/rooms/:id/cancel`

Mestre que criou a sala. Encerra a sala com `finishReason` igual a `cancelled`. Se o tempo já tinha acabado, a sala fica como `timeout` e a resposta é 409.

Resposta 200: `{ "room": <estado da sala> }`.

Erros: 403 (`Apenas o mestre que criou a sala pode encerrá-la.`), 404, 409 (`Esta sala já foi encerrada.`).

### `POST /api/rooms/:id/leave`

Jogador da sala. Sai da sala, só enquanto ela aguarda (depois do início, o jogador faz parte do histórico). Depois de sair, ele deixa de receber atualizações da sala.

Resposta 200:

```json
{
  "left": true
}
```

Erros: 404 (`Sala não encontrada.`, inclusive para quem não é da sala), 409 (`Não é possível sair depois que a sala foi iniciada.`).

## 6. Enigmas

### `GET /api/rooms/:id/puzzles`

Membro da sala ou mestre. Lista os 3 enigmas com título e status. **Não mostra o conteúdo**, então pode ser usada mesmo com a sala aguardando (por exemplo, para montar as abas da tela).

Resposta 200:

```json
{
  "puzzles": [
    {
      "key": "cipher",
      "title": "Mensagem cifrada",
      "status": "solved",
      "solvedBy": 3,
      "solvedAt": "2026-10-15T16:26:27.864Z"
    },
    {
      "key": "sequence",
      "title": "Sequência misteriosa",
      "status": "open",
      "solvedBy": null,
      "solvedAt": null
    },
    {
      "key": "maze",
      "title": "Labirinto",
      "status": "open",
      "solvedBy": null,
      "solvedAt": null
    }
  ]
}
```

### `GET /api/rooms/:id/puzzles/:key`

Membro da sala (só com a sala em andamento) ou mestre (em qualquer estado). Devolve o conteúdo do enigma mais o status.

Resposta 200 (cifra):

```json
{
  "puzzle": {
    "key": "cipher",
    "title": "Mensagem cifrada",
    "statement": "Uma mensagem foi escondida com uma cifra de deslocamento. Descubra o que ela diz.",
    "encryptedText": "FKDYH GRXUDGD",
    "status": "open",
    "solvedBy": null,
    "solvedAt": null
  }
}
```

Resposta 200 (sequência):

```json
{
  "puzzle": {
    "key": "sequence",
    "title": "Sequência misteriosa",
    "statement": "Qual é o próximo número da sequência?",
    "terms": [
      3,
      8,
      15,
      24,
      35
    ],
    "status": "open",
    "solvedBy": null,
    "solvedAt": null
  }
}
```

O labirinto devolve `start`, `end` e `edges`, como descrito na seção 3.3.

Erros:

| Código | Mensagem |
|---|---|
| 404 | `Sala não encontrada.` ou `Enigma não encontrado.` |
| 409 | `A sala não está em andamento.` (jogador com a sala aguardando ou encerrada) |

Exemplo de erro para um jogador com a sala ainda aguardando:

```json
{
  "error": "A sala não está em andamento."
}
```

### `POST /api/rooms/:id/puzzles/:key/answer`

Jogador da sala. Envia uma resposta. Regras:

- Só com a sala em andamento e dentro do tempo.
- Quando um enigma é resolvido, ele **fica bloqueado para todos**. Se dois jogadores acertarem ao mesmo tempo, só o primeiro vale.
- Toda tentativa válida é registrada, certa ou errada.
- Ao resolver o terceiro enigma, a sala termina com `finishReason` igual a `completed`.

Corpo: `{ "answer": ... }`, com o formato da tabela da seção 3.3. O tamanho máximo da resposta é de 2000 caracteres.

Resposta 200 quando erra:

```json
{
  "correct": false,
  "room": "<estado da sala, ver seção 3.2>"
}
```

Resposta 200 quando acerta (o `room` já mostra o enigma como resolvido, e `finishReason` fica `completed` se foi o último):

```json
{
  "correct": true,
  "room": "<estado da sala, ver seção 3.2>"
}
```

Erros:

| Código | Mensagem |
|---|---|
| 400 | `Envie a resposta.` |
| 400 | `Resposta grande demais.` |
| 403 | `Apenas jogadores respondem aos enigmas.` |
| 404 | `Sala não encontrada.` ou `Enigma não encontrado.` |
| 409 | `A sala não está em andamento.` |
| 409 | `O tempo da sala acabou.` |
| 409 | `Este enigma já foi resolvido.` |

Exemplo do último caso:

```json
{
  "error": "Este enigma já foi resolvido."
}
```

## 7. Histórico e painel do mestre

### Parâmetros de listagem

Valem para `GET /api/rooms/mine` e `GET /api/admin/rooms`.

| Parâmetro | Valores | Padrão | Observação |
|---|---|---|---|
| `page` | inteiro de 1 em diante | 1 | |
| `pageSize` | de 1 a 50 | 20 | |
| `status` | `waiting`, `in_progress`, `finished` | todos | |
| `reason` | `completed`, `timeout`, `cancelled` | todos | |
| `from` | `AAAA-MM-DD` | sem limite | Data de criação da sala, a partir deste dia (UTC) |
| `to` | `AAAA-MM-DD` | sem limite | Até este dia, inclusive (UTC) |
| `guided` | `true` ou `false` | `false` | Só no painel do mestre: `true` mostra apenas as salas que ele criou |

Parâmetro inválido devolve 400 com `Parâmetro inválido: <nome>.`, e `from` depois de `to` devolve `Intervalo de datas inválido.`

A resposta de cada listagem tem `rooms`, `page`, `pageSize` e `total` (total de salas que atendem aos filtros, para montar a paginação). Cada sala traz: `id`, `code`, `status`, `finishReason`, `master`, `players`, `createdAt`, `startedAt`, `finishedAt`, `timeSpentMs` (tempo gasto, só quando houve início e fim), `puzzlesSolved` e `puzzlesTotal`. Antes de listar, a API encerra as salas cujo tempo já acabou, então nunca aparece uma sala "fantasma" em andamento.

### `GET /api/rooms/mine`

Jogador. Só as sessões em que ele entrou. Mestres recebem 403 com `Mestres veem as sessões em /api/admin/rooms.`

```json
{
  "rooms": [
    {
      "id": 2,
      "code": "9RZ7UT",
      "status": "finished",
      "finishReason": "cancelled",
      "master": {
        "id": 1,
        "name": "Mestre Paulo"
      },
      "players": [
        {
          "id": 2,
          "name": "Ana"
        }
      ],
      "createdAt": "2026-10-15T16:26:27.000Z",
      "startedAt": null,
      "finishedAt": "2026-10-15T16:26:27.936Z",
      "timeSpentMs": null,
      "puzzlesSolved": 0,
      "puzzlesTotal": 3
    }
  ],
  "page": 1,
  "pageSize": 2,
  "total": 2
}
```

### `GET /api/admin/rooms`

Mestre. Todas as sessões, de todos os mestres. Com `guided=true`, apenas as que ele guiou. O formato é o mesmo de `/api/rooms/mine`.

```json
{
  "rooms": [
    {
      "id": 2,
      "code": "9RZ7UT",
      "status": "finished",
      "finishReason": "cancelled",
      "master": {
        "id": 1,
        "name": "Mestre Paulo"
      },
      "players": [
        {
          "id": 2,
          "name": "Ana"
        }
      ],
      "createdAt": "2026-10-15T16:26:27.000Z",
      "startedAt": null,
      "finishedAt": "2026-10-15T16:26:27.936Z",
      "timeSpentMs": null,
      "puzzlesSolved": 0,
      "puzzlesTotal": 3
    }
  ],
  "page": 1,
  "pageSize": 2,
  "total": 2
}
```

Erros: 401 e 403 (`Apenas o mestre pode fazer isso.`).

### `GET /api/admin/rooms/:id`

Mestre (qualquer um). É a carga inicial do painel da sala: o estado completo, um resumo por enigma e todas as tentativas, da mais antiga para a mais nova. Depois dela, o painel se mantém atualizado pelo tempo real (seção 8).

Campos: `room` (estado da sala), `summary` (por enigma: `key`, `title`, `status`, `solvedBy` com id e nome, `solvedAt`, `attempts` e `wrongAttempts`) e `attempts` (lista de tentativas, seção 3.4).

```json
{
  "room": "<estado da sala, ver seção 3.2>",
  "summary": [
  {
    "key": "cipher",
    "title": "Mensagem cifrada",
    "status": "solved",
    "solvedBy": {
      "id": 3,
      "name": "Bia"
    },
    "solvedAt": "2026-10-15T16:26:27.864Z",
    "attempts": 1,
    "wrongAttempts": 0
  },
  {
    "key": "sequence",
    "title": "Sequência misteriosa",
    "status": "open",
    "solvedBy": null,
    "solvedAt": null,
    "attempts": 1,
    "wrongAttempts": 1
  }
],
  "attempts": [
  {
    "id": 1,
    "puzzleKey": "sequence",
    "user": {
      "id": 2,
      "name": "Ana"
    },
    "answer": 47,
    "isCorrect": false,
    "createdAt": "2026-10-15T16:26:27.000Z"
  },
  {
    "id": 2,
    "puzzleKey": "cipher",
    "user": {
      "id": 3,
      "name": "Bia"
    },
    "answer": "chave dourada",
    "isCorrect": true,
    "createdAt": "2026-10-15T16:26:27.000Z"
  }
]
}
```

Erros: 401, 403, 404 (`Sala não encontrada.`).

## 8. Tempo real (Socket.IO)

O servidor envia as mudanças da sala assim que acontecem, para o painel do mestre e a tela dos jogadores não precisarem consultar a API repetidamente.

### Conexão

O token do login vai no handshake. Sem token ou com token inválido, a conexão é recusada com o erro `unauthorized`.

```js
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_API_URL, { auth: { token } });
socket.on("connect_error", (err) => { /* err.message === "unauthorized" */ });
```

### Eventos que o cliente envia

| Evento | Dados | Resposta (callback) |
|---|---|---|
| `room:subscribe` | `{ roomId }` | `{ ok: true, room }` com o estado atual, ou `{ ok: false, status, error }` |
| `room:unsubscribe` | `{ roomId }` | `{ ok: true }` |

Jogadores só se inscrevem nas salas em que estão (404 nas demais). Mestres se inscrevem em qualquer sala. Cada conexão pode ter até 10 inscrições (depois disso, `status` 429).

```json
{
  "ok": true,
  "room": "<estado da sala, ver seção 3.2>"
}
```

### Eventos que o servidor envia

| Evento | Quem recebe | Dados |
|---|---|---|
| `room:updated` | Todos os inscritos na sala | `{ type, room }` com o **estado completo** da sala |
| `attempt:new` | Só o mestre inscrito | `{ attempt }` (formato da seção 3.4) |

Valores de `type` em `room:updated`:

| `type` | Quando acontece |
|---|---|
| `player_joined` | Um jogador novo entrou pelo código |
| `player_left` | Um jogador saiu da sala |
| `started` | O mestre iniciou o cronômetro |
| `puzzle_solved` | Um enigma foi resolvido e a sala continua |
| `completed` | O terceiro enigma foi resolvido |
| `cancelled` | O mestre cancelou a sala |
| `timeout` | O tempo acabou (o servidor confere a cada segundo) |

Respostas erradas não geram `room:updated` (o estado não muda), apenas `attempt:new` para o mestre. Como o estado vem completo, basta substituir o estado local, sem tentar mesclar. A ordem entre `attempt:new` e `room:updated` não é garantida.

Exemplo de `attempt:new`:

```json
{
  "attempt": {
    "id": 1,
    "puzzleKey": "sequence",
    "user": {
      "id": 2,
      "name": "Ana"
    },
    "answer": 47,
    "isCorrect": false,
    "createdAt": "2026-10-15T16:26:27.000Z"
  }
}
```

Exemplo de `room:updated`:

```json
{
  "type": "puzzle_solved",
  "room": "<estado da sala, ver seção 3.2>"
}
```

## 9. Fluxos recomendados para o frontend

### Cronômetro

O relógio do computador do jogador pode estar diferente do servidor. Use `serverNow` e `endsAt` para acertar:

```js
const offset = room.serverNow - Date.now();            // calcule ao receber o estado
const remainingMs = Date.parse(room.endsAt) - (Date.now() + offset);
```

Atualize a tela a cada segundo com esse cálculo. Quando chegar a zero, mostre 00:00 e espere o evento `timeout`, que traz o estado final.

### Reconexão

Quando a conexão cai e volta, o servidor não lembra das inscrições. Inscreva-se de novo a cada `connect`:

```js
socket.on("connect", () => {
  socket.emit("room:subscribe", { roomId }, (res) => { if (res.ok) setRoom(res.room); });
});
```

O estado devolvido no callback cobre qualquer mudança que tenha acontecido durante a queda.

### Jogador

1. Cadastro ou login (`register` ou `login`), guardando o token.
2. Informa o código e chama `POST /api/rooms/join`.
3. Conecta o socket e se inscreve na sala. Fica em uma tela de espera até chegar `started`.
4. Com a sala em andamento, busca cada enigma em `GET /api/rooms/:id/puzzles/:key` e envia respostas em `.../answer`.
5. A cada `room:updated`, atualiza o estado. Enigmas com `status` igual a `solved` ficam bloqueados.
6. Em `completed`, `timeout` ou `cancelled`, mostra o resultado. O histórico fica em `GET /api/rooms/mine`.

### Mestre

1. Login com a conta de mestre.
2. `POST /api/rooms` e mostra o código aos jogadores (que se comunicam por uma chamada externa).
3. Abre o painel: `GET /api/admin/rooms/:id` para a carga inicial, e se inscreve na sala pelo socket.
4. Acompanha as entradas (`player_joined`) e, quando quiser, inicia com `POST /api/rooms/:id/start`.
5. Durante a partida, recebe `attempt:new` a cada tentativa e `room:updated` a cada mudança. Pode cancelar com `POST /api/rooms/:id/cancel`.
6. A lista de sessões, com filtros, fica em `GET /api/admin/rooms`.