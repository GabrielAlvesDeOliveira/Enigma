import { caesarDecrypt, normalizeText } from "../algorithms/cipher.js";

const ENCRYPTED_TEXT = "FKDYH GRXUDGD";
const SHIFT = 3;

export default {
  key: "cipher",

  getPublicData() {
    return {
      key: "cipher",
      title: "Mensagem cifrada",
      statement:
        "Uma mensagem foi escondida com uma cifra de deslocamento. Descubra o que ela diz.",
      encryptedText: ENCRYPTED_TEXT,
    };
  },

  validate(answer) {
    if (typeof answer !== "string") return false;
    return normalizeText(answer) === caesarDecrypt(ENCRYPTED_TEXT, SHIFT);
  },
};
