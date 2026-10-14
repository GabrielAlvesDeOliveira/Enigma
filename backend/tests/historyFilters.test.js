import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHistoryFilters } from "../src/utils/historyFilters.js";

const DAY = 24 * 60 * 60 * 1000;

test("filtros: valores padrão quando nada é informado", () => {
  assert.deepEqual(parseHistoryFilters({}), {
    page: 1,
    pageSize: 20,
    status: null,
    finishReason: null,
    guided: false,
    fromMs: null,
    toMs: null,
  });
  assert.equal(parseHistoryFilters().page, 1);
});

test("filtros: aceita valores válidos e o dia final entra inteiro", () => {
  const f = parseHistoryFilters({
    page: "3",
    pageSize: "50",
    status: "finished",
    reason: "completed",
    guided: "true",
    from: "2026-10-01",
    to: "2026-10-31",
  });

  assert.equal(f.page, 3);
  assert.equal(f.pageSize, 50);
  assert.equal(f.status, "finished");
  assert.equal(f.finishReason, "completed");
  assert.equal(f.guided, true);
  assert.equal(f.fromMs, Date.UTC(2026, 9, 1));
  assert.equal(f.toMs, Date.UTC(2026, 10, 1)); // início de 01/11, exclusivo
  assert.equal(f.toMs - Date.UTC(2026, 9, 31), DAY);
});

test("filtros: guided=false é aceito e vale falso", () => {
  assert.equal(parseHistoryFilters({ guided: "false" }).guided, false);
});

test("filtros: rejeita valores inválidos com erro 400", () => {
  const cases = [
    { page: "0" },
    { page: "-1" },
    { page: "abc" },
    { page: "1.5" },
    { page: "1000000" },
    { pageSize: "0" },
    { pageSize: "51" },
    { status: "qualquer" },
    { reason: "qualquer" },
    { guided: "sim" },
    { from: "2026-13-01" },
    { from: "2026-02-30" },
    { from: "01/10/2026" },
    { to: "ontem" },
    { from: "2026-10-10", to: "2026-10-01" },
    { status: ["finished", "waiting"] }, // parâmetro repetido na URL
  ];

  for (const query of cases) {
    assert.throws(() => parseHistoryFilters(query), (err) => err.status === 400, JSON.stringify(query));
  }
});

test("filtros: mesmo dia em from e to é um intervalo válido de 1 dia", () => {
  const f = parseHistoryFilters({ from: "2026-10-14", to: "2026-10-14" });
  assert.equal(f.toMs - f.fromMs, DAY);
});