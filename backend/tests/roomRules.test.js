import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PLAYERS,
  ROOM_DURATION_MS,
  computeEndsAt,
  remainingMs,
  isExpired,
  joinDecision,
  startDecision,
  answerDecision,
  shouldTimeout,
} from "../src/services/roomRules.js";
import { toMillis } from "../src/utils/time.js";

// ---------- Constantes ----------

test("constantes: 3 jogadores e 40 minutos", () => {
  assert.equal(MAX_PLAYERS, 3);
  assert.equal(ROOM_DURATION_MS, 40 * 60 * 1000);
});

// ---------- Tempo ----------

test("tempo: fim previsto é o início mais 40 minutos", () => {
  assert.equal(computeEndsAt(1_000), 1_000 + 2_400_000);
  assert.equal(computeEndsAt(1_000, 5_000), 6_000);
});

test("tempo: restante nunca fica negativo", () => {
  assert.equal(remainingMs(10_000, 4_000), 6_000);
  assert.equal(remainingMs(10_000, 10_000), 0);
  assert.equal(remainingMs(10_000, 99_000), 0);
});

test("tempo: expira exatamente no horário final", () => {
  assert.equal(isExpired(10_000, 9_999), false);
  assert.equal(isExpired(10_000, 10_000), true);
  assert.equal(isExpired(10_000, 10_001), true);
});

// ---------- Conversão de datas ----------

test("toMillis: aceita número, Date e textos nos formatos do SQLite e ISO", () => {
  const expected = Date.UTC(2026, 9, 14, 0, 30, 9);

  assert.equal(toMillis(expected), expected);
  assert.equal(toMillis(new Date(expected)), expected);
  assert.equal(toMillis("2026-10-14 00:30:09"), expected);
  assert.equal(toMillis("2026-10-14T00:30:09Z"), expected);
  assert.equal(toMillis("2026-10-13T21:30:09-03:00"), expected);
});

test("toMillis: devolve null para vazio ou inválido", () => {
  for (const value of [null, undefined, "", "lixo", NaN, new Date("x"), {}, []]) {
    assert.equal(toMillis(value), null, String(value));
  }
});

// ---------- Entrar na sala ----------

test("entrar: permitido enquanto aguarda e há vaga", () => {
  assert.equal(joinDecision({ status: "waiting", playerCount: 0, isMember: false }).allowed, true);
  assert.equal(joinDecision({ status: "waiting", playerCount: 2, isMember: false }).allowed, true);
});

test("entrar: sala cheia é recusada", () => {
  const result = joinDecision({ status: "waiting", playerCount: 3, isMember: false });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 409);
});

test("entrar: sem entrada tardia depois do início ou do fim", () => {
  for (const status of ["in_progress", "finished"]) {
    assert.equal(joinDecision({ status, playerCount: 1, isMember: false }).allowed, false, status);
  }
});

test("entrar: quem já é membro sempre pode voltar", () => {
  for (const status of ["waiting", "in_progress", "finished"]) {
    assert.equal(joinDecision({ status, playerCount: 3, isMember: true }).allowed, true, status);
  }
});

// ---------- Iniciar a sala ----------

test("iniciar: precisa aguardar e ter de 1 jogador em diante", () => {
  assert.equal(startDecision({ status: "waiting", playerCount: 1 }).allowed, true);
  assert.equal(startDecision({ status: "waiting", playerCount: 3 }).allowed, true);
  assert.equal(startDecision({ status: "waiting", playerCount: 0 }).allowed, false);
  assert.equal(startDecision({ status: "in_progress", playerCount: 2 }).allowed, false);
  assert.equal(startDecision({ status: "finished", playerCount: 2 }).allowed, false);
});

// ---------- Responder enigmas ----------

test("responder: só com a sala em andamento e dentro do tempo", () => {
  const now = 5_000;

  assert.equal(answerDecision({ status: "in_progress", endsAtMs: 10_000 }, now).allowed, true);
  assert.equal(answerDecision({ status: "in_progress", endsAtMs: 5_000 }, now).allowed, false);
  assert.equal(answerDecision({ status: "in_progress", endsAtMs: null }, now).allowed, false);
  assert.equal(answerDecision({ status: "waiting", endsAtMs: null }, now).allowed, false);
  assert.equal(answerDecision({ status: "finished", endsAtMs: 10_000 }, now).allowed, false);
});

// ---------- Tempo esgotado ----------

test("tempo esgotado: só encerra salas em andamento que passaram do horário", () => {
  const now = 10_000;

  assert.equal(shouldTimeout({ status: "in_progress", endsAtMs: 10_000 }, now), true);
  assert.equal(shouldTimeout({ status: "in_progress", endsAtMs: 10_001 }, now), false);
  assert.equal(shouldTimeout({ status: "in_progress", endsAtMs: null }, now), false);
  assert.equal(shouldTimeout({ status: "waiting", endsAtMs: 1 }, now), false);
  assert.equal(shouldTimeout({ status: "finished", endsAtMs: 1 }, now), false);
});
