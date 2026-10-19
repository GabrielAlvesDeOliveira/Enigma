import { nextTermByDifferences } from "../algorithms/sequence.js";

const TERMS = [3, 8, 15, 24, 35];

export default {
  key: "sequence",

  getPublicData() {
    return {
      key: "sequence",
      title: "Sequência misteriosa",
      statement: "Qual é o próximo número da sequência?",
      terms: TERMS,
    };
  },

  validate(answer) {
    if (typeof answer !== "number" && typeof answer !== "string") return false;

    const text = String(answer).trim().replace(",", ".");
    if (text === "") return false;

    const value = Number(text);
    if (!Number.isFinite(value)) return false;

    return value === nextTermByDifferences(TERMS);
  },
};
