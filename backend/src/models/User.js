import db from "../config/db.js";
import { toMillis } from "../utils/time.js";

// Dados do usuário que podem sair da API (nunca inclui o hash da senha).
export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at == null ? null : new Date(toMillis(row.created_at)).toISOString(),
  };
}

export function findById(id) {
  return db("users").where({ id }).first();
}

export function findByEmail(email) {
  return db("users").where({ email }).first();
}

export async function create({ name, email, passwordHash, role = "player" }) {
  const [row] = await db("users")
    .insert({ name, email, password_hash: passwordHash, role })
    .returning("id");

  // SQLite devolve o id direto, PostgreSQL devolve um objeto { id }.
  const id = typeof row === "object" ? row.id : row;
  return findById(id);
}
