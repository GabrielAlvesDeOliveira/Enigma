import { test, before, after } from "node:test";
import assert from "node:assert/strict";

// Ambiente de teste: banco SQLite em memória, sem tocar no dev.sqlite3.
process.env.DB_CLIENT = "sqlite";
process.env.DB_FILE = ":memory:";
process.env.JWT_SECRET = "segredo-de-teste";
process.env.BCRYPT_ROUNDS = "4";

const { default: db } = await import("../src/config/db.js");
const User = await import("../src/models/User.js");
const Room = await import("../src/models/Room.js");
const RoomPlayer = await import("../src/models/RoomPlayer.js");
const { sweepOverdueRooms, startSweeper } = await import("../src/services/roomSweeper.js");
const { roomEvents, ROOM_CHANGED } = await import("../src/events/roomEvents.js");

let masterId, playerId, codeCounter = 0;
const events = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Cria uma sala diretamente no banco com o estado e o fim indicados.
async function makeRoom({ status = "in_progress", endsInMs = -1_000 } = {}) {
  const code = ("AAAAAA" + (++codeCounter).toString(36).toUpperCase()).slice(-6);
  const room = await Room.create({ code, createdBy: masterId });
  await RoomPlayer.add(room.id, playerId);

  if (status !== "waiting") {
    await Room.transition(room.id, ["waiting"], {
      status,
      startedAtMs: Date.now() - 60_000,
      endsAtMs: Date.now() + endsInMs,
    });
  }
  return room.id;
}

before(async () => {
  await db.migrate.latest();
  masterId = (await User.create({ name: "Mestre", email: "m@t.com", passwordHash: "x", role: "admin" })).id;
  playerId = (await User.create({ name: "Ana", email: "a@t.com", passwordHash: "x", role: "player" })).id;
  roomEvents.on(ROOM_CHANGED, (event) => events.push(event));
});

after(async () => {
  await db.destroy();
});

test("sweep: encerra só salas em andamento com tempo vencido", async () => {
  const overdue = await makeRoom({ endsInMs: -5_000 });
  const running = await makeRoom({ endsInMs: 600_000 });
  const waiting = await makeRoom({ status: "waiting" });
  events.length = 0;

  const closed = await sweepOverdueRooms();

  assert.equal(closed, 1);
  const after = await Room.findById(overdue);
  assert.equal(after.status, "finished");
  assert.equal(after.finishReason, "timeout");
  assert.equal(after.finishedAtMs, after.endsAtMs); // terminou no horário previsto

  assert.equal((await Room.findById(running)).status, "in_progress");
  assert.equal((await Room.findById(waiting)).status, "waiting");
  assert.deepEqual(events.map((e) => [e.roomId, e.type]), [[overdue, "timeout"]]);
});

test("sweep: é idempotente (segunda chamada não faz nada nem avisa de novo)", async () => {
  const id = await makeRoom({ endsInMs: -1_000 });
  assert.ok((await sweepOverdueRooms()) >= 1);

  events.length = 0;
  assert.equal(await sweepOverdueRooms(), 0);
  assert.deepEqual(events, []);
  assert.equal((await Room.findById(id)).finishReason, "timeout");
});

test("sweep: usa o horário informado (sala só vence quando o relógio passa do fim)", async () => {
  const id = await makeRoom({ endsInMs: 600_000 });

  // com o relógio de agora, nenhuma sala vence (as dos testes anteriores também terminam depois)
  assert.equal(await sweepOverdueRooms(Date.now()), 0);
  assert.equal((await Room.findById(id)).status, "in_progress");

  // com o relógio avançado, esta sala vence (outras ainda abertas também podem vencer)
  assert.ok((await sweepOverdueRooms(Date.now() + 601_000)) >= 1);
  assert.equal((await Room.findById(id)).finishReason, "timeout");
});

test("sweeper: verifica sozinho em intervalos e para quando mandado", async () => {
  const stop = startSweeper(30);

  const id = await makeRoom({ endsInMs: -1_000 });
  await sleep(400);
  assert.equal((await Room.findById(id)).status, "finished");

  stop();
  const later = await makeRoom({ endsInMs: -1_000 });
  await sleep(250);
  assert.equal((await Room.findById(later)).status, "in_progress"); // ninguém encerrou
});
