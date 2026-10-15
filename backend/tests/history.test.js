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
const { signToken } = await import("../src/services/authService.js");

const CIPHER = "chave dourada";
const { solutionPath: MAZE } = await import("../src/services/puzzles/mazePuzzle.js");

let server, baseUrl;
let masterA, masterB, tokenA, tokenB;
const players = [];
const rooms = {}; // r1..r5

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

async function createRoom(token, joined, { start = false } = {}) {
  const { data } = await call("POST", "/api/rooms", token);
  const { id, code } = data.room;
  for (const i of joined) await call("POST", "/api/rooms/join", players[i].token, { code });
  if (start) await call("POST", `/api/rooms/${id}/start`, token);
  return id;
}

const answer = (roomId, key, token, value) =>
  call("POST", `/api/rooms/${roomId}/puzzles/${key}/answer`, token, { answer: value });

const ids = (res) => res.data.rooms.map((r) => r.id);

before(async () => {
  await db.migrate.latest();
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;

  masterA = await newUser("MestreA", "admin");
  masterB = await newUser("MestreB", "admin");
  tokenA = masterA.token;
  tokenB = masterB.token;
  for (const name of ["Ana", "Bia", "Caio", "Davi"]) players.push(await newUser(name, "player"));

  // r1 (mestre A): Ana e Bia, 1 erro e depois os 3 enigmas resolvidos -> concluída
  rooms.r1 = await createRoom(tokenA, [0, 1], { start: true });
  await answer(rooms.r1, "sequence", players[0].token, 47);
  await answer(rooms.r1, "cipher", players[0].token, CIPHER);
  await answer(rooms.r1, "sequence", players[1].token, 48);
  await answer(rooms.r1, "maze", players[1].token, MAZE);

  // r2 (mestre A): Ana -> cancelada
  rooms.r2 = await createRoom(tokenA, [0]);
  await call("POST", `/api/rooms/${rooms.r2}/cancel`, tokenA);

  // r3 (mestre B): Ana e Caio, iniciada e com o tempo vencido (ninguém consultou a sala)
  rooms.r3 = await createRoom(tokenB, [0, 2], { start: true });
  await db("rooms").where({ id: rooms.r3 }).update({ ends_at: new Date(Date.now() - 5_000) });

  // r4 (mestre B): Bia aguardando
  rooms.r4 = await createRoom(tokenB, [1]);

  // r5 (mestre A): sem jogadores, aguardando
  rooms.r5 = await createRoom(tokenA, []);
});

after(async () => {
  server.close();
  await db.destroy();
});

// ---------- Histórico do jogador ----------

test("jogador: vê só as sessões em que entrou, da mais nova para a mais antiga", async () => {
  const ana = await call("GET", "/api/rooms/mine", players[0].token);
  assert.equal(ana.status, 200);
  assert.deepEqual(ids(ana), [rooms.r3, rooms.r2, rooms.r1]);
  assert.equal(ana.data.total, 3);

  const bia = await call("GET", "/api/rooms/mine", players[1].token);
  assert.deepEqual(ids(bia), [rooms.r4, rooms.r1]);

  const davi = await call("GET", "/api/rooms/mine", players[3].token);
  assert.deepEqual(davi.data.rooms, []);
  assert.equal(davi.data.total, 0);
});

test("jogador: o resumo traz mestre, jogadores, progresso e tempo gasto", async () => {
  const { data } = await call("GET", "/api/rooms/mine", players[0].token);
  const r1 = data.rooms.find((r) => r.id === rooms.r1);

  assert.equal(r1.status, "finished");
  assert.equal(r1.finishReason, "completed");
  assert.equal(r1.master.name, "MestreA");
  assert.deepEqual(r1.players.map((p) => p.name).sort(), ["Ana", "Bia"]);
  assert.equal(r1.puzzlesSolved, 3);
  assert.equal(r1.puzzlesTotal, 3);
  assert.ok(r1.timeSpentMs >= 0);
  assert.equal(typeof r1.createdAt, "string");
  assert.equal(typeof r1.startedAt, "string");

  const r2 = data.rooms.find((r) => r.id === rooms.r2);
  assert.equal(r2.finishReason, "cancelled");
  assert.equal(r2.startedAt, null);
  assert.equal(r2.timeSpentMs, null);
  assert.equal(r2.puzzlesSolved, 0);
});

test("jogador: sala com tempo vencido já aparece como tempo esgotado na listagem", async () => {
  const { data } = await call("GET", "/api/rooms/mine", players[2].token);
  const r3 = data.rooms.find((r) => r.id === rooms.r3);

  assert.equal(r3.status, "finished");
  assert.equal(r3.finishReason, "timeout");
  assert.equal(r3.finishedAt !== null, true);
});

test("jogador: filtros e paginação", async () => {
  const cancelled = await call("GET", "/api/rooms/mine?reason=cancelled", players[0].token);
  assert.deepEqual(ids(cancelled), [rooms.r2]);

  const finished = await call("GET", "/api/rooms/mine?status=finished", players[0].token);
  assert.equal(finished.data.total, 3);

  const waiting = await call("GET", "/api/rooms/mine?status=waiting", players[1].token);
  assert.deepEqual(ids(waiting), [rooms.r4]);

  const page1 = await call("GET", "/api/rooms/mine?pageSize=2&page=1", players[0].token);
  const page2 = await call("GET", "/api/rooms/mine?pageSize=2&page=2", players[0].token);
  assert.deepEqual(ids(page1), [rooms.r3, rooms.r2]);
  assert.deepEqual(ids(page2), [rooms.r1]);
  assert.equal(page1.data.total, 3);
  assert.equal(page2.data.page, 2);

  const beyond = await call("GET", "/api/rooms/mine?page=9", players[0].token);
  assert.deepEqual(beyond.data.rooms, []);
});

test("jogador: parâmetros inválidos dão 400 e mestre não usa essa rota", async () => {
  assert.equal((await call("GET", "/api/rooms/mine?page=0", players[0].token)).status, 400);
  assert.equal((await call("GET", "/api/rooms/mine?status=x", players[0].token)).status, 400);
  assert.equal((await call("GET", "/api/rooms/mine", tokenA)).status, 403);
  assert.equal((await call("GET", "/api/rooms/mine")).status, 401);
});

// ---------- Histórico do mestre ----------

test("mestre: vê todas as sessões, e guided=true mostra só as que ele guiou", async () => {
  const all = await call("GET", "/api/admin/rooms", tokenA);
  assert.equal(all.status, 200);
  assert.deepEqual(ids(all), [rooms.r5, rooms.r4, rooms.r3, rooms.r2, rooms.r1]);

  const guidedA = await call("GET", "/api/admin/rooms?guided=true", tokenA);
  assert.deepEqual(ids(guidedA), [rooms.r5, rooms.r2, rooms.r1]);

  const guidedB = await call("GET", "/api/admin/rooms?guided=true", tokenB);
  assert.deepEqual(ids(guidedB), [rooms.r4, rooms.r3]);
});

test("mestre: filtros por status, motivo e combinações", async () => {
  const waiting = await call("GET", "/api/admin/rooms?status=waiting", tokenA);
  assert.deepEqual(ids(waiting), [rooms.r5, rooms.r4]);

  const timeout = await call("GET", "/api/admin/rooms?reason=timeout", tokenA);
  assert.deepEqual(ids(timeout), [rooms.r3]);

  const completedByA = await call("GET", "/api/admin/rooms?reason=completed&guided=true", tokenA);
  assert.deepEqual(ids(completedByA), [rooms.r1]);

  const none = await call("GET", "/api/admin/rooms?reason=completed&guided=true", tokenB);
  assert.deepEqual(none.data.rooms, []);
});

test("mestre: filtro por data (hoje inclui tudo; amanhã e ontem não incluem nada)", async () => {
  const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  const today = await call("GET", `/api/admin/rooms?from=${day(0)}&to=${day(0)}`, tokenA);
  assert.equal(today.data.total, 5);

  const fromTomorrow = await call("GET", `/api/admin/rooms?from=${day(1)}`, tokenA);
  assert.equal(fromTomorrow.data.total, 0);

  const untilYesterday = await call("GET", `/api/admin/rooms?to=${day(-1)}`, tokenA);
  assert.equal(untilYesterday.data.total, 0);

  const fromYesterday = await call("GET", `/api/admin/rooms?from=${day(-1)}`, tokenA);
  assert.equal(fromYesterday.data.total, 5);

  assert.equal((await call("GET", "/api/admin/rooms?from=2026-02-30", tokenA)).status, 400);
  assert.equal((await call("GET", `/api/admin/rooms?from=${day(1)}&to=${day(-1)}`, tokenA)).status, 400);
});

test("mestre: paginação com total", async () => {
  const page1 = await call("GET", "/api/admin/rooms?pageSize=2", tokenA);
  const page3 = await call("GET", "/api/admin/rooms?pageSize=2&page=3", tokenA);

  assert.equal(page1.data.rooms.length, 2);
  assert.equal(page1.data.total, 5);
  assert.equal(page3.data.rooms.length, 1);
});

test("mestre: rotas exclusivas (jogador 403, sem login 401)", async () => {
  assert.equal((await call("GET", "/api/admin/rooms", players[0].token)).status, 403);
  assert.equal((await call("GET", "/api/admin/rooms")).status, 401);
  assert.equal((await call("GET", `/api/admin/rooms/${rooms.r1}`, players[0].token)).status, 403);
});

// ---------- Painel do mestre (detalhe) ----------

test("painel: estado, resumo por enigma e todas as tentativas", async () => {
  const { status, data } = await call("GET", `/api/admin/rooms/${rooms.r1}`, tokenA);

  assert.equal(status, 200);
  assert.equal(data.room.id, rooms.r1);
  assert.equal(data.room.finishReason, "completed");

  assert.equal(data.attempts.length, 4);
  assert.deepEqual(
    data.attempts.map((a) => [a.puzzleKey, a.user.name, a.isCorrect]),
    [
      ["sequence", "Ana", false],
      ["cipher", "Ana", true],
      ["sequence", "Bia", true],
      ["maze", "Bia", true],
    ]
  );
  assert.equal(data.attempts[0].answer, 47);
  assert.deepEqual(data.attempts[3].answer, MAZE);
  assert.equal(typeof data.attempts[0].createdAt, "string");

  const bySequence = data.summary.find((s) => s.key === "sequence");
  assert.equal(bySequence.title, "Sequência misteriosa");
  assert.equal(bySequence.status, "solved");
  assert.equal(bySequence.solvedBy.name, "Bia");
  assert.equal(bySequence.attempts, 2);
  assert.equal(bySequence.wrongAttempts, 1);

  const cipher = data.summary.find((s) => s.key === "cipher");
  assert.equal(cipher.solvedBy.name, "Ana");
  assert.equal(cipher.wrongAttempts, 0);
});

test("painel: qualquer mestre vê, sala sem tentativas e ids inválidos", async () => {
  const other = await call("GET", `/api/admin/rooms/${rooms.r1}`, tokenB);
  assert.equal(other.status, 200);

  const empty = await call("GET", `/api/admin/rooms/${rooms.r5}`, tokenA);
  assert.deepEqual(empty.data.attempts, []);
  assert.ok(empty.data.summary.every((s) => s.status === "open" && s.attempts === 0 && s.solvedBy === null));

  assert.equal((await call("GET", "/api/admin/rooms/abc", tokenA)).status, 404);
  assert.equal((await call("GET", "/api/admin/rooms/999999", tokenA)).status, 404);
});
