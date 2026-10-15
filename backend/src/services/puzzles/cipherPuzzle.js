import { caesarDecrypt, normalizeText } from "../algorithms/cipher.js";

// CONTEÚDO DE EXEMPLO: a equipe pode trocar a frase e o deslocamento.
// Texto que o jogador vê (a frase "CHAVE DOURADA" cifrada com deslocamento 3).
const ENCRYPTED_TEXT = "FKDYH GRXUDGD";
const SHIFT = 3;

export default {
  key: "cipher",

  // Dados enviados ao frontend. Nunca inclui a resposta nem o deslocamento.
  getPublicData() {
    return {
      key: "cipher",
      title: "Mensagem cifrada",
      statement:
        "Uma mensagem foi escondida com uma cifra de deslocamento. Descubra o que ela diz.",
      encryptedText: ENCRYPTED_TEXT,
    };
  },

  // Decifra o texto com o algoritmo e compara com a resposta do jogador.
  validate(answer) {
    if (typeof answer !== "string") return false;
    return normalizeText(answer) === caesarDecrypt(ENCRYPTED_TEXT, SHIFT);
  },
};
