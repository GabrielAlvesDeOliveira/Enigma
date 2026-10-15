import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";

// Ambiente de teste: banco SQLite em memória, sem tocar no dev.sqlite3.
process.env.DB_CLIENT = "sqlite";
process.env.DB_FILE = ":memory:";
process.env.JWT_SECRET = "segredo-de-teste";

const { default: db } = await import("../src/config/db.js");
const { default: app } = await import("../src/app.js");
const User = await import("../src/models/User.js");
const { signToken } = await import("../src/services/authService.js");

// A documentação fica em Enigma/docs/API.md (uma pasta acima de backend/).
const DOC_URL = new URL("../../docs/API.md", import.meta.url);
const SRC_URL = new URL("../src/", import.meta.url);
const ROUTES_URL = new URL("../src/routes/", import.meta.url);

const skip = fs.existsSync(DOC_URL) ? false : "docs/API.md não encontrado (esperado em Enigma/docs/API.md)";
const doc = skip ? "" : fs.readFileSync(DOC_URL, "utf8");

// Endpoints documentados: cabeçalhos no formato  ### `GET /api/rooms/:id`
function documentedEndpoints() {
  return [...doc.matchAll(/^### `(GET|POST|PUT|PATCH|DELETE) (\/[^`]*)`$/gm)].map((m) => ({
    method: m[1],
    path: m[2],
  }));
}

function readAllSource(dirUrl) {
  return fs
    .readdirSync(dirUrl, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => fs.readFileSync(`${entry.parentPath}/${entry.name}`, "utf8"))
    .join("\n");
}

after(async () => {
  await db.destroy();
});

test("API.md: nenhum endpoint documentado em duplicidade", { skip }, () => {
  const labels = documentedEndpoints().map((e) => `${e.method} ${e.path}`);
  assert.ok(labels.length > 0, "nenhum endpoint encontrado no documento");
  assert.equal(new Set(labels).size, labels.length);
});

test("API.md: todo endpoint documentado existe de verdade", { skip }, async () => {
  // Rotas de /api/rooms e /api/admin exigem login antes de tudo. Sem token, qualquer
  // caminho dessas áreas devolveria 401 e não daria para saber se a rota existe.
  // Por isso o teste usa um mestre de verdade, que passa pelo login e pela permissão.
  await db.migrate.latest();
  const master = await User.create({ name: "Mestre", email: "docs@teste.com", passwordHash: "x", role: "admin" });
  const token = signToken(master);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;

  try {
    for (const { method, path } of documentedEndpoints()) {
      const url = base + path.replace(":id", "1").replace(":key", "cipher");
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: method === "GET" ? undefined : "{}",
      });
      const data = await res.json();

      // Rota que não existe devolve exatamente este 404. Qualquer outra resposta
      // (200, 400, 403, 404 de sala...) prova que a rota está registrada.
      const missing = res.status === 404 && data.error === "Rota não encontrada.";
      assert.equal(missing, false, `${method} ${path} está documentado mas não existe`);
    }
  } finally {
    server.close();
  }
});

test("API.md: a quantidade de endpoints documentados bate com a do código", { skip }, () => {
  const routeFiles = fs.readdirSync(ROUTES_URL).filter((name) => name.endsWith(".js"));
  const routeDefinition = /router\.(get|post|put|patch|delete)\(/g;

  let implemented = 0;
  for (const name of routeFiles) {
    const source = fs.readFileSync(new URL(name, ROUTES_URL), "utf8");
    implemented += (source.match(routeDefinition) || []).length;
  }

  // /health é definido direto no app.js
  const appSource = fs.readFileSync(new URL("app.js", SRC_URL), "utf8");
  implemented += (appSource.match(/app\.(get|post|put|patch|delete)\(/g) || []).length;

  assert.equal(
    documentedEndpoints().length,
    implemented,
    "há endpoints no código que não estão no API.md (ou o contrário)"
  );
});

test("API.md: toda mensagem de erro listada nas tabelas existe no código", { skip }, () => {
  const source = readAllSource(SRC_URL);
  const rows = [...doc.matchAll(/^\| (400|401|403|404|409|429|500) \| (.+) \|$/gm)];
  assert.ok(rows.length > 10, "nenhuma tabela de erros encontrada");

  for (const row of rows) {
    const messages = [...row[2].matchAll(/`([^`]+)`/g)].map((m) => m[1]);

    for (const message of messages) {
      assert.ok(source.includes(message), `mensagem documentada não existe no código: "${message}"`);
    }
  }
});
