import test from "node:test";
import assert from "node:assert/strict";

// O knexfile lê as variáveis de ambiente quando é carregado. Para testar cada combinação,
// ele é importado de novo (com um sufixo na URL, que ignora o cache) com o ambiente montado.
const KEYS = ["NODE_ENV", "DB_CLIENT", "DATABASE_URL", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_FILE"];
let counter = 0;

async function loadKnexfile(env) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, env);
  try {
    return (await import(`../knexfile.js?caso=${counter++}`)).default;
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test("no computador, sem configuração, o padrão é SQLite", async () => {
  const config = await loadKnexfile({});
  assert.equal(config.development.client, "better-sqlite3");
  assert.equal(config.development.connection.filename, "./dev.sqlite3");
});

test("em produção, sem DB_CLIENT, o padrão é PostgreSQL (nunca um SQLite que seria apagado)", async () => {
  const config = await loadKnexfile({ NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@host/db" });
  assert.equal(config.production.client, "pg");
});

test("o ambiente production existe (a Render roda com NODE_ENV=production)", async () => {
  const config = await loadKnexfile({ DB_CLIENT: "pg", DATABASE_URL: "postgresql://u:p@host/db" });
  assert.ok(config.production, "falta a chave production");
  assert.deepEqual(config.production, config.development);
});

test("DATABASE_URL vira a conexão inteira, com o sslmode que a Neon exige", async () => {
  const url = "postgresql://usuario:segredo@ep-exemplo.neon.tech/enigma?sslmode=require";
  const config = await loadKnexfile({ DB_CLIENT: "pg", DATABASE_URL: url });
  assert.deepEqual(config.development.connection, { connectionString: url });
});

test("sem DATABASE_URL, a conexão usa as variáveis DB_HOST, DB_PORT, DB_USER, DB_PASSWORD e DB_NAME", async () => {
  const config = await loadKnexfile({ DB_CLIENT: "pg", DB_HOST: "localhost", DB_PORT: "5432", DB_USER: "postgres", DB_PASSWORD: "x", DB_NAME: "enigma_dev" });
  assert.deepEqual(config.development.connection, { host: "localhost", port: "5432", user: "postgres", password: "x", database: "enigma_dev" });
});

test("o PostgreSQL não guarda conexões ociosas (a Neon suspende o banco quando fica parado)", async () => {
  const config = await loadKnexfile({ DB_CLIENT: "pg", DATABASE_URL: "postgresql://u:p@host/db" });
  assert.equal(config.development.pool.min, 0);
  assert.ok(config.development.pool.max >= 2 && config.development.pool.max <= 10);
});

test("DB_CLIENT=sqlite continua valendo, mesmo em produção (escolha explícita)", async () => {
  const config = await loadKnexfile({ NODE_ENV: "production", DB_CLIENT: "sqlite" });
  assert.equal(config.production.client, "better-sqlite3");
});
