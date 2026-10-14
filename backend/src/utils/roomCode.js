import { randomInt } from "node:crypto";

// Alfabeto sem 0, O, 1, I e L, que se confundem na hora de ler e digitar.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

const CODE_REGEX = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

// Gera um código aleatório para a sala. Usa o sorteio seguro do Node, porque
// quem souber o código consegue entrar na sala enquanto ela aguarda.
// O parâmetro "random" existe para os testes poderem controlar o sorteio.
export function generateRoomCode(random = randomInt) {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  }
  return code;
}

// Limpa o que o jogador digitou (espaços e minúsculas) e confere o formato.
// Devolve o código em maiúsculas ou null se for inválido.
export function normalizeRoomCode(input) {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  return CODE_REGEX.test(code) ? code : null;
}