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
const roomService = await import("../src/services/roomService.js");
const { signToken } = await import("../src/services/authService.js");
const { PUZZLE_KEYS } = await import("../src/services/puzzles/index.js");
const { CODE_ALPHABET } = await import("../src/utils/roomCode.js");

let server;
let baseUrl;
let masterA, masterB, tokenA, tokenB;
const players = []; // { id, token }

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

// Cria uma sala nova do mestre A e devolve { id, code }.
async function newRoom(token = tokenA) {
  const { status, data } = await call("POST", "/api/rooms", token);
  assert.equal(status, 201);
  return { id: data.room.id, code: data.room.code };
}

before(async () => {
  await db.migrate.latest();
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;

  masterA = await newUser("MestreA", "admin");
  masterB = await newUser("MestreB", "admin");
  tokenA = masterA.token;
  tokenB = masterB.token;

  for (const name of ["Ana", "Bia", "Caio", "Davi", "Eva"]) {
    players.push(await newUser(name, "player"));
  }
});

after(async () => {
  server.close();
  await db.destroy();
});

// ---------- Criar sala ----------

test("criar: só o mestre cria e a sala nasce aguardando, com 3 enigmas abertos", async () => {
  assert.equal((await call("POST", "/api/rooms")).status, 401);
  assert.equal((await call("POST", "/api/rooms", players[0].token)).status, 403);

  const { status, data } = await call("POST", "/api/rooms", tokenA);
  const room = data.room;

  assert.equal(status, 201);
  assert.equal(room.status, "waiting");
  assert.equal(room.code.length, 6);
  assert.ok([...room.code].every((ch) => CODE_ALPHABET.includes(ch)));
  assert.equal(room.master.id, masterA.id);
  assert.deepEqual(room.players, []);
  assert.equal(room.remainingMs, 40 * 60 * 1000);
  assert.equal(room.startedAt, null);
  assert.equal(typeof room.serverNow, "number");
  assert.deepEqual(room.puzzles.map((p) => p.key), PUZZLE_KEYS);
  assert.ok(room.puzzles.every((p) => p.status === "open" && p.solvedBy === null));
});

test("criar: repete o sorteio quando o código já existe", async () => {
  const first = await roomService.createRoom(masterA.id, { generateCode: () => "AAAAAA" });
  assert.equal(first.code, "AAAAAA");

  const codes = ["AAAAAA", "BBBBBB"];
  const second = await roomService.createRoom(masterA.id, { generateCode: () => codes.shift() });
  assert.equal(second.code, "BBBBBB");
});

test("criar: desiste com erro se todos os sorteios colidirem", async () => {
  await assert.rejects(
    roomService.createRoom(masterA.id, { generateCode: () => "AAAAAA" }),
    (err) => err.status === 500
  );
});

// ---------- Entrar ----------

test("entrar: jogador entra pelo código (aceita minúsculas) e repetir não duplica", async () => {
  const { code } = await newRoom();

  const first = await call("POST", "/api/rooms/join", players[0].token, { code: code.toLowerCase() });
  assert.equal(first.status, 200);
  assert.equal(first.data.room.players.length, 1);
  assert.equal(first.data.room.players[0].name, "Ana");

  const again = await call("POST", "/api/rooms/join", players[0].token, { code });
  assert.equal(again.status, 200);
  assert.equal(again.data.room.players.length, 1);
});

test("entrar: valida código, mestre não entra e código inexistente dá 404", async () => {
  const { code } = await newRoom();

  assert.equal((await call("POST", "/api/rooms/join", players[0].token, { code: "ab" })).status, 400);
  assert.equal((await call("POST", "/api/rooms/join", players[0].token, {})).status, 400);
  assert.equal((await call("POST", "/api/rooms/join", players[0].token)).status, 400);
  assert.equal((await call("POST", "/api/rooms/join", tokenA, { code })).status, 403);
  assert.equal((await call("POST", "/api/rooms/join", players[0].token, { code: "ZZZZZZ" })).status, 404);
  assert.equal((await call("POST", "/api/rooms/join")).status, 401);
});

test("entrar: no máximo 3 jogadores, mesmo com 5 tentando ao mesmo tempo", async () => {
  const { id, code } = await newRoom();

  const results = await Promise.all(
    players.map((p) => call("POST", "/api/rooms/join", p.token, { code }))
  );

  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 200, 200, 409, 409]);

  const state = await call("GET", `/api/rooms/${id}`, tokenA);
  assert.equal(state.data.room.players.length, 3);
});

// ---------- Estado da sala ----------

test("estado: membro e qualquer mestre veem; quem não é membro recebe 404", async () => {
  const { id, code } = await newRoom();
  await call("POST", "/api/rooms/join", players[0].token, { code });

  assert.equal((await call("GET", `/api/rooms/${id}`, players[0].token)).status, 200);
  assert.equal((await call("GET", `/api/rooms/${id}`, tokenA)).status, 200);
  assert.equal((await call("GET", `/api/rooms/${id}`, tokenB)).status, 200);
  assert.equal((await call("GET", `/api/rooms/${id}`, players[1].token)).status, 404);
  assert.equal((await call("GET", `/api/rooms/${id}`)).status, 401);
  assert.equal((await call("GET", "/api/rooms/abc", tokenA)).status, 404);
  assert.equal((await call("GET", "/api/rooms/999999", tokenA)).status, 404);
});

// ---------- Iniciar ----------

test("iniciar: só o mestre dono, e só com pelo menos 1 jogador", async () => {
  const { id, code } = await newRoom();

  assert.equal((await call("POST", `/api/rooms/${id}/start`, players[0].token)).status, 403);
  assert.equal((await call("POST", `/api/rooms/${id}/start`, tokenB)).status, 403);
  assert.equal((await call("POST", `/api/rooms/${id}/start`, tokenA)).status, 409); // sem jogadores

  await call("POST", "/api/rooms/join", players[0].token, { code });

  const started = await call("POST", `/api/rooms/${id}/start`, tokenA);
  const room = started.data.room;

  assert.equal(started.status, 200);
  assert.equal(room.status, "in_progress");
  assert.equal(new Date(room.endsAt) - new Date(room.startedAt), 40 * 60 * 1000);
  assert.ok(room.remainingMs > 2_390_000 && room.remainingMs <= 2_400_000);

  assert.equal((await call("POST", `/api/rooms/${id}/start`, tokenA)).status, 409); // já iniciada
});

test("sem entrada tardia: depois do início só os membros voltam", async () => {
  const { id, code } = await newRoom();
  await call("POST", "/api/rooms/join", players[0].token, { code });
  await call("POST", `/api/rooms/${id}/start`, tokenA);

  assert.equal((await call("POST", "/api/rooms/join", players[1].token, { code })).status, 409);
  assert.equal((await call("POST", "/api/rooms/join", players[0].token, { code })).status, 200);
});

// ---------- Tempo esgotado ----------

test("tempo esgotado: a sala é encerrada na próxima consulta", async () => {
  const { id, code } = await newRoom();
  await call("POST", "/api/rooms/join", players[0].token, { code });
  await call("POST", `/api/rooms/${id}/start`, tokenA);

  const past = Date.now() - 5_000;
  await db("rooms").where({ id }).update({ ends_at: new Date(past) });

  const state = await call("GET", `/api/rooms/${id}`, players[0].token);
  assert.equal(state.data.room.status, "finished");
  assert.equal(state.data.room.finishReason, "timeout");
  assert.equal(state.data.room.remainingMs, 0);
  assert.equal(state.data.room.finishedAt, new Date(past).toISOString());

  const again = await call("GET", `/api/rooms/${id}`, tokenA);
  assert.equal(again.data.room.finishReason, "timeout");
});

// ---------- Cancelar ----------

test("cancelar: só o mestre dono, uma vez só", async () => {
  const { id, code } = await newRoom();
  await call("POST", "/api/rooms/join", players[0].token, { code });

  assert.equal((await call("POST", `/api/rooms/${id}/cancel`, players[0].token)).status, 403);
  assert.equal((await call("POST", `/api/rooms/${id}/cancel`, tokenB)).status, 403);

  const cancelled = await call("POST", `/api/rooms/${id}/cancel`, tokenA);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.room.status, "finished");
  assert.equal(cancelled.data.room.finishReason, "cancelled");

  assert.equal((await call("POST", `/api/rooms/${id}/cancel`, tokenA)).status, 409);
});

test("cancelar: se o tempo já tinha acabado, o motivo registrado é tempo esgotado", async () => {
  const { id, code } = await newRoom();
  await call("POST", "/api/rooms/join", players[0].token, { code });
  await call("POST", `/api/rooms/${id}/start`, tokenA);
  await db("rooms").where({ id }).update({ ends_at: new Date(Date.now() - 1_000) });

  assert.equal((await call("POST", `/api/rooms/${id}/cancel`, tokenA)).status, 409);

  const state = await call("GET", `/api/rooms/${id}`, tokenA);
  assert.equal(state.data.room.finishReason, "timeout");
});

// ---------- Sair ----------

test("sair: só enquanto a sala aguarda e só quem é membro", async () => {
  const { id, code } = await newRoom();
  await call("POST", "/api/rooms/join", players[0].token, { code });

  assert.equal((await call("POST", `/api/rooms/${id}/leave`, players[1].token)).status, 404);

  const left = await call("POST", `/api/rooms/${id}/leave`, players[0].token);
  assert.equal(left.status, 200);
  assert.equal((await call("GET", `/api/rooms/${id}`, tokenA)).data.room.players.length, 0);

  await call("POST", "/api/rooms/join", players[0].token, { code });
  await call("POST", `/api/rooms/${id}/start`, tokenA);
  assert.equal((await call("POST", `/api/rooms/${id}/leave`, players[0].token)).status, 409);
}); 