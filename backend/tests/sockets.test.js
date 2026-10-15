import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { io as ioClient } from "socket.io-client";

// Ambiente de teste: banco SQLite em memória, sem tocar no dev.sqlite3.
process.env.DB_CLIENT = "sqlite";
process.env.DB_FILE = ":memory:";
process.env.JWT_SECRET = "segredo-de-teste";
process.env.BCRYPT_ROUNDS = "4";

const { default: db } = await import("../src/config/db.js");
const { default: app } = await import("../src/app.js");
const { attachSockets } = await import("../src/sockets/index.js");
const { sweepOverdueRooms } = await import("../src/services/roomSweeper.js");
const User = await import("../src/models/User.js");
const { signToken } = await import("../src/services/authService.js");

const CIPHER = "chave dourada";
const MAZE = ["entrada", "A", "C", "E", "saida"];

let httpServer, realtime, baseUrl;
let masterA, masterB, tokenA, tokenB;
const players = [];
const clients = [];

// ---------- Ajudantes ----------

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

function connect(token) {
  const socket = ioClient(baseUrl, { auth: { token }, transports: ["websocket"], reconnection: false });
  clients.push(socket);

  return new Promise((resolve, reject) => {
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}

// Espera um evento (opcionalmente que satisfaça o filtro).
function waitFor(socket, event, predicate = () => true, ms = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Tempo esgotado esperando "${event}"`));
    }, ms);

    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

// Junta todos os eventos recebidos durante um tempo (para provar que NÃO chegou nada).
function collect(socket, event, ms = 350) {
  return new Promise((resolve) => {
    const received = [];
    const handler = (payload) => received.push(payload);
    socket.on(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(received);
    }, ms);
  });
}

const subscribe = (socket, roomId) => socket.emitWithAck("room:subscribe", { roomId });

// Cria uma sala (mestre A) e conecta o mestre e os jogadores indicados, todos inscritos.
// Os jogadores em "joined" entram na sala; os em "outsiders" só se conectam.
async function setup({ joined = [], start = false } = {}) {
  const created = await call("POST", "/api/rooms", tokenA);
  const { id, code } = created.data.room;

  for (const i of joined) await call("POST", "/api/rooms/join", players[i].token, { code });
  if (start) await call("POST", `/api/rooms/${id}/start`, tokenA);

  const master = await connect(tokenA);
  assert.equal((await subscribe(master, id)).ok, true);

  const sockets = {};
  for (const i of joined) {
    sockets[i] = await connect(players[i].token);
    assert.equal((await subscribe(sockets[i], id)).ok, true);
  }

  return { id, code, master, sockets };
}

const answer = (roomId, key, token, value) =>
  call("POST", `/api/rooms/${roomId}/puzzles/${key}/answer`, token, { answer: value });

before(async () => {
  await db.migrate.latest();

  httpServer = http.createServer(app);
  realtime = attachSockets(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  baseUrl = `http://localhost:${httpServer.address().port}`;

  masterA = await newUser("MestreA", "admin");
  masterB = await newUser("MestreB", "admin");
  tokenA = masterA.token;
  tokenB = masterB.token;
  for (const name of ["Ana", "Bia", "Caio", "Davi"]) players.push(await newUser(name, "player"));
});

after(async () => {
  for (const socket of clients) socket.disconnect();
  await realtime.close();
  await db.destroy();
});

// ---------- Conexão e inscrição ----------

test("conexão: sem token ou com token inválido é recusada", async () => {
  await assert.rejects(connect(undefined), /unauthorized/);
  await assert.rejects(connect("lixo"), /unauthorized/);
});

test("inscrição: membro e mestre recebem o estado atual", async () => {
  const { id, code, master, sockets } = await setup({ joined: [0] });

  const fromMaster = await subscribe(master, id);
  assert.equal(fromMaster.ok, true);
  assert.equal(fromMaster.room.code, code);

  const fromPlayer = await subscribe(sockets[0], id);
  assert.equal(fromPlayer.ok, true);
  assert.equal(fromPlayer.room.players.length, 1);
});

test("inscrição: quem não é da sala, sala inexistente e dados inválidos são recusados", async () => {
  const { id } = await setup({ joined: [0] });
  const outsider = await connect(players[3].token);

  assert.deepEqual(
    { ...(await subscribe(outsider, id)) },
    { ok: false, status: 404, error: "Sala não encontrada." }
  );
  assert.equal((await subscribe(outsider, 999999)).status, 404);
  assert.equal((await subscribe(outsider, "abc")).status, 404);
  assert.equal((await outsider.emitWithAck("room:subscribe", null)).status, 404);

  // sem função de retorno (ack) também não derruba nada
  outsider.emit("room:subscribe", { roomId: id });
  assert.equal((await subscribe(outsider, 999999)).status, 404);
});

test("inscrição recusada: quem não é da sala também não recebe as atualizações depois", async () => {
  const { id, master } = await setup({ joined: [0] });
  const outsider = await connect(players[3].token);

  assert.equal((await subscribe(outsider, id)).ok, false);

  const leaked = collect(outsider, "room:updated", 600);
  const forMaster = waitFor(master, "room:updated", (e) => e.type === "started");

  await call("POST", `/api/rooms/${id}/start`, tokenA);

  await forMaster;
  assert.deepEqual(await leaked, []);
});

// ---------- Eventos da sala ----------

test("entrada de jogador: mestre e jogadores inscritos são avisados; voltar à sala não avisa", async () => {
  const { id, code, master, sockets } = await setup({ joined: [0] });

  const forMaster = waitFor(master, "room:updated", (e) => e.type === "player_joined");
  const forPlayer = waitFor(sockets[0], "room:updated", (e) => e.type === "player_joined");

  await call("POST", "/api/rooms/join", players[1].token, { code });

  const [m, p] = await Promise.all([forMaster, forPlayer]);
  assert.equal(m.room.players.length, 2);
  assert.equal(p.room.players.length, 2);
  assert.equal(m.room.id, id);

  // o mesmo jogador voltando não é uma entrada nova
  const none = collect(master, "room:updated");
  await call("POST", "/api/rooms/join", players[1].token, { code });
  assert.deepEqual(await none, []);
});

test("início: todos recebem o novo estado com o horário de término", async () => {
  const { id, master, sockets } = await setup({ joined: [0, 1] });

  const forMaster = waitFor(master, "room:updated", (e) => e.type === "started");
  const forPlayers = [0, 1].map((i) => waitFor(sockets[i], "room:updated", (e) => e.type === "started"));

  await call("POST", `/api/rooms/${id}/start`, tokenA);

  for (const event of await Promise.all([forMaster, ...forPlayers])) {
    assert.equal(event.room.status, "in_progress");
    assert.equal(typeof event.room.endsAt, "string");
    assert.ok(event.room.remainingMs > 2_390_000);
  }
});

test("tentativas: só o mestre vê cada tentativa; erro não muda o estado da sala", async () => {
  const { id, master, sockets } = await setup({ joined: [0, 1], start: true });

  const attempt = waitFor(master, "attempt:new");
  const playerAttempts = collect(sockets[1], "attempt:new");
  const noRoomUpdate = collect(master, "room:updated");

  await answer(id, "sequence", players[0].token, 47);

  const { attempt: a } = await attempt;
  assert.equal(a.puzzleKey, "sequence");
  assert.equal(a.user.name, "Ana");
  assert.equal(a.answer, 47);
  assert.equal(a.isCorrect, false);
  assert.equal(typeof a.createdAt, "string");

  assert.deepEqual(await playerAttempts, []);
  assert.deepEqual(await noRoomUpdate, []);
});

test("acerto: todos veem o enigma resolvido e o mestre vê a tentativa", async () => {
  const { id, master, sockets } = await setup({ joined: [0, 1], start: true });

  const solved = [master, sockets[0], sockets[1]].map((s) =>
    waitFor(s, "room:updated", (e) => e.type === "puzzle_solved")
  );
  const attempt = waitFor(master, "attempt:new", (e) => e.attempt.isCorrect);

  await answer(id, "cipher", players[1].token, CIPHER);

  for (const event of await Promise.all(solved)) {
    const cipher = event.room.puzzles.find((p) => p.key === "cipher");
    assert.equal(cipher.status, "solved");
    assert.equal(cipher.solvedBy, players[1].id);
    assert.equal(event.room.status, "in_progress");
  }
  assert.equal((await attempt).attempt.user.name, "Bia");
});

test("conclusão: resolver os 3 enigmas avisa que a sala foi concluída", async () => {
  const { id, master, sockets } = await setup({ joined: [0], start: true });

  await answer(id, "cipher", players[0].token, CIPHER);
  await answer(id, "sequence", players[0].token, 48);

  const done = [master, sockets[0]].map((s) => waitFor(s, "room:updated", (e) => e.type === "completed"));
  await answer(id, "maze", players[0].token, MAZE);

  for (const event of await Promise.all(done)) {
    assert.equal(event.room.status, "finished");
    assert.equal(event.room.finishReason, "completed");
  }
});

test("cancelamento: todos são avisados", async () => {
  const { id, master, sockets } = await setup({ joined: [0] });

  const events = [master, sockets[0]].map((s) => waitFor(s, "room:updated", (e) => e.type === "cancelled"));
  await call("POST", `/api/rooms/${id}/cancel`, tokenA);

  for (const event of await Promise.all(events)) {
    assert.equal(event.room.finishReason, "cancelled");
  }
});

// ---------- Tempo esgotado ----------

test("tempo esgotado: o encerramento automático avisa todos, uma única vez", async () => {
  const { id, master, sockets } = await setup({ joined: [0], start: true });
  await db("rooms").where({ id }).update({ ends_at: new Date(Date.now() - 2_000) });

  const events = [master, sockets[0]].map((s) => waitFor(s, "room:updated", (e) => e.type === "timeout"));
  const duplicates = collect(master, "room:updated", 500);

  assert.ok((await sweepOverdueRooms()) >= 1);

  for (const event of await Promise.all(events)) {
    assert.equal(event.room.status, "finished");
    assert.equal(event.room.finishReason, "timeout");
    assert.equal(event.room.remainingMs, 0);
  }

  assert.equal(await sweepOverdueRooms(), 0);
  assert.equal((await duplicates).filter((e) => e.type === "timeout").length, 1);
});

test("tempo esgotado: se uma consulta HTTP encerrar primeiro, o aviso sai uma só vez", async () => {
  const { id, master } = await setup({ joined: [0], start: true });
  await db("rooms").where({ id }).update({ ends_at: new Date(Date.now() - 2_000) });

  const received = collect(master, "room:updated", 600);

  await call("GET", `/api/rooms/${id}`, tokenA); // encerra na consulta
  await sweepOverdueRooms(); // chega atrasada e não faz nada

  assert.equal((await received).filter((e) => e.type === "timeout").length, 1);
});

test("tempo esgotado: responder depois do fim recusa a resposta e avisa a sala", async () => {
  const { id, master } = await setup({ joined: [0], start: true });
  await db("rooms").where({ id }).update({ ends_at: new Date(Date.now() - 2_000) });

  const timeout = waitFor(master, "room:updated", (e) => e.type === "timeout");
  const res = await answer(id, "cipher", players[0].token, CIPHER);

  assert.equal(res.status, 409);
  assert.equal((await timeout).room.finishReason, "timeout");
});

// ---------- Isolamento ----------

test("sair da sala: quem saiu deixa de receber as atualizações", async () => {
  const { id, code, master, sockets } = await setup({ joined: [0] });

  const left = waitFor(master, "room:updated", (e) => e.type === "player_left");
  const leaverEvents = collect(sockets[0], "room:updated", 700);

  await call("POST", `/api/rooms/${id}/leave`, players[0].token);
  assert.equal((await left).room.players.length, 0);

  const joined = waitFor(master, "room:updated", (e) => e.type === "player_joined");
  await call("POST", "/api/rooms/join", players[1].token, { code });
  await joined;

  assert.deepEqual(await leaverEvents, []);
});

test("cancelar a inscrição: o jogador para de receber, o mestre continua", async () => {
  const { id, master, sockets } = await setup({ joined: [0] });

  assert.equal((await sockets[0].emitWithAck("room:unsubscribe", { roomId: id })).ok, true);

  const playerEvents = collect(sockets[0], "room:updated");
  const masterEvent = waitFor(master, "room:updated", (e) => e.type === "started");

  await call("POST", `/api/rooms/${id}/start`, tokenA);

  await masterEvent;
  assert.deepEqual(await playerEvents, []);
});

test("isolamento: eventos de uma sala não chegam a inscritos de outra", async () => {
  const one = await setup({ joined: [0] });
  const two = await setup({ joined: [1] });

  const noLeak = collect(two.master, "room:updated");
  const forOne = waitFor(one.master, "room:updated", (e) => e.type === "started");

  await call("POST", `/api/rooms/${one.id}/start`, tokenA);

  await forOne;
  assert.deepEqual(await noLeak, []);
});

test("limite: um cliente não pode se inscrever em salas demais", async () => {
  const socket = await connect(tokenB);
  const ids = [];

  for (let i = 0; i < 11; i++) {
    const created = await call("POST", "/api/rooms", tokenB);
    ids.push(created.data.room.id);
  }

  for (const id of ids.slice(0, 10)) assert.equal((await subscribe(socket, id)).ok, true);

  const eleventh = await subscribe(socket, ids[10]);
  assert.equal(eleventh.ok, false);
  assert.equal(eleventh.status, 429);

  // quem já está inscrito pode se inscrever de novo sem problema
  assert.equal((await subscribe(socket, ids[0])).ok, true);
});