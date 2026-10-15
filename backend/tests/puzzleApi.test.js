import { test, before, after } from "node:test";
import assert from "node:assert/strict";

// Ambiente de teste: banco SQLite em memória, sem tocar no dev.sqlite3.
process.env.DB_CLIENT = "sqlite";
process.env.DB_FILE = ":memory:";
process.env.JWT_SECRET = "segredo-de-teste";
process.env.BCRYPT_ROUNDS = "4";

const { default: db } = await import("../src/config/db.js");
const { default: app } = await import("../src/app.js");
const User = await import("../src/models/User.js");
const PuzzleAttempt = await import("../src/models/PuzzleAttempt.js");
const { signToken } = await import("../src/services/authService.js");

const CIPHER = "chave dourada";
const SEQUENCE = 48;
const { solutionPath: MAZE } = await import("../src/services/puzzles/mazePuzzle.js");
const WRONG_MAZE = MAZE.slice(0, 5); // caminho válido até certo ponto, mas que não chega ao fim

let server, baseUrl;
let master, other, masterToken;
const players = [];

async function call(method, path, token, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function newUser(name, role) {
  const row = await User.create({ name, email: `${name.toLowerCase()}@teste.com`, passwordHash: "x", role });
  return { id: row.id, token: signToken(row) };
}

// Cria uma sala com os jogadores indicados. Se start = true, já inicia.
async function setupRoom({ joined = [0, 1, 2], start = true } = {}) {
  const created = await call("POST", "/api/rooms", masterToken);
  const { id, code } = created.data.room;

  for (const i of joined) await call("POST", "/api/rooms/join", players[i].token, { code });
  if (start) assert.equal((await call("POST", `/api/rooms/${id}/start`, masterToken)).status, 200);

  return id;
}

const answer = (roomId, key, token, value) =>
  call("POST", `/api/rooms/${roomId}/puzzles/${key}/answer`, token, { answer: value });

before(async () => {
  await db.migrate.latest();
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;

  master = await newUser("Mestre", "admin");
  other = await newUser("OutroMestre", "admin");
  masterToken = master.token;

  for (const name of ["Ana", "Bia", "Caio", "Davi"]) players.push(await newUser(name, "player"));
});

after(async () => {
  server.close();
  await db.destroy();
});

// ---------- Listar e ver ----------

test("listar: mostra os 3 enigmas só com título e status, mesmo com a sala aguardando", async () => {
  const id = await setupRoom({ joined: [0], start: false });

  const { status, data } = await call("GET", `/api/rooms/${id}/puzzles`, players[0].token);

  assert.equal(status, 200);
  assert.deepEqual(data.puzzles.map((p) => p.key), ["cipher", "sequence", "maze"]);
  assert.ok(data.puzzles.every((p) => p.status === "open" && typeof p.title === "string"));
  assert.equal(JSON.stringify(data).includes("encryptedText"), false);
});

test("ver: jogador só recebe o conteúdo com a sala em andamento; o mestre vê sempre", async () => {
  const waiting = await setupRoom({ joined: [0], start: false });

  assert.equal((await call("GET", `/api/rooms/${waiting}/puzzles/cipher`, players[0].token)).status, 409);

  const asMaster = await call("GET", `/api/rooms/${waiting}/puzzles/cipher`, masterToken);
  assert.equal(asMaster.status, 200);
  assert.equal(asMaster.data.puzzle.encryptedText, "FKDYH GRXUDGD");

  const running = await setupRoom({ joined: [0] });
  const cipher = await call("GET", `/api/rooms/${running}/puzzles/cipher`, players[0].token);
  const sequence = await call("GET", `/api/rooms/${running}/puzzles/sequence`, players[0].token);
  const maze = await call("GET", `/api/rooms/${running}/puzzles/maze`, players[0].token);

  assert.equal(cipher.data.puzzle.encryptedText, "FKDYH GRXUDGD");
  assert.deepEqual(sequence.data.puzzle.terms, [3, 8, 15, 24, 35]);
  assert.equal(maze.data.puzzle.start, "1,1");
  assert.equal(maze.data.puzzle.end, "9,13");
  assert.equal(maze.data.puzzle.rows, maze.data.puzzle.layout.length);
  assert.equal(maze.data.puzzle.cols, maze.data.puzzle.layout[0].length);
  assert.ok(maze.data.puzzle.layout.every((row) => row.length === maze.data.puzzle.cols));
  assert.equal(JSON.stringify(maze.data).includes(MAZE.join(",")), false); // a solução não vai junto

  for (const res of [cipher, sequence, maze]) {
    assert.equal(res.data.puzzle.status, "open");
    const json = JSON.stringify(res.data).toLowerCase();
    assert.equal("answer" in res.data.puzzle, false);
    assert.equal(json.includes("shift"), false);
    assert.equal(json.includes("dourada"), false);
  }
});

test("acesso: sem login 401, fora da sala 404, enigma ou sala inexistente 404", async () => {
  const id = await setupRoom({ joined: [0] });

  assert.equal((await call("GET", `/api/rooms/${id}/puzzles`)).status, 401);
  assert.equal((await call("GET", `/api/rooms/${id}/puzzles`, players[3].token)).status, 404);
  assert.equal((await call("GET", `/api/rooms/${id}/puzzles/cipher`, players[3].token)).status, 404);
  assert.equal((await answer(id, "cipher", players[3].token, CIPHER)).status, 404);
  assert.equal((await call("GET", `/api/rooms/${id}/puzzles/nao-existe`, masterToken)).status, 404);
  assert.equal((await call("GET", `/api/rooms/${id}/puzzles/constructor`, masterToken)).status, 404);
  assert.equal((await answer(id, "nao-existe", players[0].token, "x")).status, 404);
  assert.equal((await call("GET", "/api/rooms/abc/puzzles", masterToken)).status, 404);
  assert.equal((await call("GET", "/api/rooms/999999/puzzles", masterToken)).status, 404);
  assert.equal((await call("GET", `/api/rooms/${id}/puzzles`, other.token)).status, 200);
});

// ---------- Responder ----------

test("responder: acerto resolve o enigma e registra quem resolveu", async () => {
  const id = await setupRoom();

  const { status, data } = await answer(id, "cipher", players[1].token, CIPHER);
  assert.equal(status, 200);
  assert.equal(data.correct, true);

  const cipher = data.room.puzzles.find((p) => p.key === "cipher");
  assert.equal(cipher.status, "solved");
  assert.equal(cipher.solvedBy, players[1].id);
  assert.equal(typeof cipher.solvedAt, "string");
  assert.equal(data.room.status, "in_progress");

  const attempts = await PuzzleAttempt.listForRoom(id);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].isCorrect, true);
  assert.equal(attempts[0].userName, "Bia");
  assert.equal(attempts[0].answer, CIPHER);
});

test("responder: erro não resolve, mas a tentativa fica registrada (inclusive caminho do labirinto)", async () => {
  const id = await setupRoom();

  const wrong = await answer(id, "sequence", players[0].token, 47);
  assert.equal(wrong.status, 200);
  assert.equal(wrong.data.correct, false);
  assert.equal(wrong.data.room.puzzles.find((p) => p.key === "sequence").status, "open");

  await answer(id, "maze", players[0].token, WRONG_MAZE);
  await answer(id, "cipher", players[0].token, 42);

  const attempts = await PuzzleAttempt.listForRoom(id);
  assert.equal(attempts.length, 3);
  assert.ok(attempts.every((a) => a.isCorrect === false));
  assert.deepEqual(attempts[1].answer, WRONG_MAZE);
  assert.equal(attempts[2].answer, 42);
});

test("responder: valida o corpo da requisição", async () => {
  const id = await setupRoom();

  const noBody = await call("POST", `/api/rooms/${id}/puzzles/cipher/answer`, players[0].token);
  const empty = await call("POST", `/api/rooms/${id}/puzzles/cipher/answer`, players[0].token, {});
  const huge = await answer(id, "cipher", players[0].token, "x".repeat(3000));

  assert.equal(noBody.status, 400);
  assert.equal(empty.status, 400);
  assert.equal(huge.status, 400);
  assert.equal((await PuzzleAttempt.listForRoom(id)).length, 0);
});

test("responder: o mestre não responde enigmas", async () => {
  const id = await setupRoom();
  assert.equal((await answer(id, "cipher", masterToken, CIPHER)).status, 403);
});

test("responder: sala aguardando não aceita respostas", async () => {
  const id = await setupRoom({ joined: [0], start: false });
  assert.equal((await answer(id, "cipher", players[0].token, CIPHER)).status, 409);
  assert.equal((await PuzzleAttempt.listForRoom(id)).length, 0);
});

// ---------- Primeiro acerto vence ----------

test("primeiro acerto vence: dois acertos simultâneos, só um vale", async () => {
  const id = await setupRoom();

  const results = await Promise.all([
    answer(id, "cipher", players[0].token, CIPHER),
    answer(id, "cipher", players[1].token, CIPHER),
    answer(id, "cipher", players[2].token, CIPHER),
  ]);

  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409]);

  const attempts = await PuzzleAttempt.listForRoom(id);
  assert.equal(attempts.length, 1);
});

test("enigma resolvido fica bloqueado para todos, até para respostas erradas", async () => {
  const id = await setupRoom();
  await answer(id, "maze", players[0].token, MAZE);

  const retry = await answer(id, "maze", players[1].token, WRONG_MAZE);
  assert.equal(retry.status, 409);
  assert.equal((await PuzzleAttempt.listForRoom(id)).length, 1);

  // os outros enigmas continuam abertos
  assert.equal((await answer(id, "cipher", players[1].token, CIPHER)).status, 200);
});

// ---------- Concluir a sala ----------

test("concluir: resolver os 3 enigmas (por jogadores diferentes) encerra a sala como concluída", async () => {
  const id = await setupRoom();

  await answer(id, "cipher", players[0].token, CIPHER);
  const afterTwo = await answer(id, "sequence", players[1].token, String(SEQUENCE));
  assert.equal(afterTwo.data.room.status, "in_progress");

  const last = await answer(id, "maze", players[2].token, MAZE);
  assert.equal(last.data.correct, true);
  assert.equal(last.data.room.status, "finished");
  assert.equal(last.data.room.finishReason, "completed");
  assert.equal(typeof last.data.room.finishedAt, "string");
  assert.equal(last.data.room.remainingMs, 0);
  assert.ok(last.data.room.puzzles.every((p) => p.status === "solved"));

  assert.equal((await answer(id, "cipher", players[0].token, CIPHER)).status, 409);
  assert.equal((await call("GET", `/api/rooms/${id}/puzzles/cipher`, players[0].token)).status, 409);
});

test("concluir: sala com 1 jogador também pode ser concluída", async () => {
  const id = await setupRoom({ joined: [3] });

  await answer(id, "cipher", players[3].token, CIPHER);
  await answer(id, "sequence", players[3].token, SEQUENCE);
  const last = await answer(id, "maze", players[3].token, MAZE);

  assert.equal(last.data.room.finishReason, "completed");
});

// ---------- Tempo esgotado ----------

test("tempo esgotado: a resposta é recusada e a sala é encerrada como timeout", async () => {
  const id = await setupRoom();
  await db("rooms").where({ id }).update({ ends_at: new Date(Date.now() - 1_000) });

  const res = await answer(id, "cipher", players[0].token, CIPHER);
  assert.equal(res.status, 409);

  const state = await call("GET", `/api/rooms/${id}`, masterToken);
  assert.equal(state.data.room.status, "finished");
  assert.equal(state.data.room.finishReason, "timeout");
  assert.equal((await PuzzleAttempt.listForRoom(id)).length, 0);
});
