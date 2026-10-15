import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJson, toJsonColumn, toBool } from "../src/utils/dbTypes.js";
import { parseId } from "../src/utils/parseId.js";

test("parseJson: aceita texto (SQLite) e objeto (PostgreSQL)", () => {
  assert.deepEqual(parseJson('["entrada","A"]'), ["entrada", "A"]);
  assert.deepEqual(parseJson(["entrada", "A"]), ["entrada", "A"]);
  assert.equal(parseJson(null), null);
  assert.equal(parseJson(undefined), null);
});

test("parseJson: texto inválido lança erro em vez de esconder o problema", () => {
  assert.throws(() => parseJson("{ quebrado"));
});

test("toJsonColumn: sempre devolve texto JSON", () => {
  assert.equal(toJsonColumn(["a", 1]), '["a",1]');
  assert.equal(toJsonColumn("texto"), '"texto"');
});

test("toBool: entende 1/0 (SQLite) e true/false (PostgreSQL)", () => {
  for (const value of [1, true, "1", "t", "true"]) assert.equal(toBool(value), true, String(value));
  for (const value of [0, false, "0", "f", null, undefined]) assert.equal(toBool(value), false, String(value));
});

test("parseId: aceita inteiros positivos e devolve 404 para o resto", () => {
  assert.equal(parseId("7"), 7);
  assert.equal(parseId("2147483647"), 2147483647);

  for (const value of ["0", "-1", "abc", "1.5", "", "01", "2147483648", "99999999999", undefined]) {
    assert.throws(() => parseId(value), (err) => err.status === 404, String(value));
  }
});
