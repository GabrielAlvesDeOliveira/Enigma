// Erro de valor repetido em coluna única (código do PostgreSQL ou do SQLite).
export function isUniqueViolation(err) {
  return (
    err?.code === "23505" ||
    err?.code === "SQLITE_CONSTRAINT_UNIQUE" ||
    err?.code === "SQLITE_CONSTRAINT_PRIMARYKEY"
  );
}
