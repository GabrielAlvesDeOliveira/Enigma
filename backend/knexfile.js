import "dotenv/config";

const migrations = { directory: "./src/database/migrations" };
const seeds = { directory: "./src/database/seeds" };

const sqlite = {
  client: "better-sqlite3",
  connection: { filename: process.env.DB_FILE || "./dev.sqlite3" },
  useNullAsDefault: true,
  pool: {
    // O SQLite só respeita chaves estrangeiras se isso for ligado em cada conexão.
    afterCreate: (conn, done) => {
      conn.pragma("foreign_keys = ON");
      done();
    },
  },
  migrations,
  seeds,
};

const postgres = {
  client: "pg",
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  migrations,
  seeds,
};

// DB_CLIENT=sqlite (padrão no desenvolvimento) ou DB_CLIENT=pg
const useSqlite = (process.env.DB_CLIENT || "sqlite") === "sqlite";

export default {
  development: useSqlite ? sqlite : postgres,
};