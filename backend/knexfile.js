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

// PostgreSQL.
// Na hospedagem (Render + Neon) a conexão vem em um endereço único, DATABASE_URL: ele já traz
// usuário, senha e o "sslmode=require" que a Neon exige. No computador de cada um continuam
// valendo DB_HOST, DB_PORT, DB_USER, DB_PASSWORD e DB_NAME.
const postgres = {
  client: "pg",
  connection: process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
  // A Neon suspende o banco depois de alguns minutos sem uso. Sem conexões ociosas guardadas
  // (min: 0), não sobra nenhuma conexão "morta" depois do banco acordar.
  pool: { min: 0, max: 5 },
  migrations,
  seeds,
};

// Em produção (NODE_ENV=production, que a Render define) o padrão é PostgreSQL. Assim nunca se
// usa, por engano, um arquivo SQLite que seria apagado a cada reinício do servidor.
// No computador, sem DB_CLIENT, o padrão continua sendo SQLite.
const defaultClient = process.env.NODE_ENV === "production" ? "pg" : "sqlite";
const useSqlite = (process.env.DB_CLIENT || defaultClient) === "sqlite";
const database = useSqlite ? sqlite : postgres;

export default {
  development: database,
  production: database,
};
