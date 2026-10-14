import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  generateRoomCode,
  normalizeRoomCode,
} from "../src/utils/roomCode.js";

test("alfabeto: sem caracteres que se confundem e sem repetições", () => {
  for (const ch of ["0", "O", "1", "I", "L"]) {
    assert.equal(CODE_ALPHABET.includes(ch), false, `contém ${ch}`);
  }
  assert.equal(new Set(CODE_ALPHABET).size, CODE_ALPHABET.length);
  assert.equal(CODE_ALPHABET.length, 31);
});

test("gerador: produz 6 caracteres, todos do alfabeto", () => {
  for (let i = 0; i < 1000; i++) {
    const code = generateRoomCode();
    assert.equal(code.length, CODE_LENGTH);
    assert.ok([...code].every((ch) => CODE_ALPHABET.includes(ch)), code);
  }
});

test("gerador: respeita o sorteio injetado (primeiro e último caracteres)", () => {
  assert.equal(generateRoomCode(() => 0), "AAAAAA");
  assert.equal(generateRoomCode((max) => max - 1), "999999");
});

test("gerador: todo código gerado passa na normalização", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateRoomCode();
    assert.equal(normalizeRoomCode(code), code);
  }
});

test("normalizar: aceita minúsculas e espaços nas pontas", () => {
  assert.equal(normalizeRoomCode(" abc234 "), "ABC234");
});

test("normalizar: rejeita formatos inválidos e tipos errados", () => {
  const invalid = ["ABC23", "ABC2345", "ABCO23", "ABC0I1", "abc-234", "ABC 234", "", null, undefined, 123456, ["ABC234"]];
  for (const input of invalid) {
    assert.equal(normalizeRoomCode(input), null, String(input));
  }
});