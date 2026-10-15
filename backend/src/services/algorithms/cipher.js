const CODE_A = "A".charCodeAt(0);

// Remove acentos, deixa em maiúsculas e ajusta os espaços.
export function normalizeText(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Desloca cada letra de A a Z em "shift" posições (Cifra de César).
// Caracteres que não são letras ficam como estão.
export function caesarShift(text, shift) {
  const k = ((shift % 26) + 26) % 26;
  let result = "";

  for (const ch of normalizeText(text)) {
    if (ch >= "A" && ch <= "Z") {
      const code = ((ch.charCodeAt(0) - CODE_A + k) % 26) + CODE_A;
      result += String.fromCharCode(code);
    } else {
      result += ch;
    }
  }

  return result;
}

export const caesarEncrypt = (text, shift) => caesarShift(text, shift);
export const caesarDecrypt = (text, shift) => caesarShift(text, -shift);
