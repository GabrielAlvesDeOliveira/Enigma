import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

// Ambiente de teste: banco SQLite em memória, sem tocar no dev.sqlite3.
process.env.DB_CLIENT = "sqlite";
process.env.DB_FILE = ":memory:";
process.env.JWT_SECRET = "segredo-de-teste";
process.env.BCRYPT_ROUNDS = "4";

const { default: db } = await import("../src/config/db.js");
const { default: app } = await import("../src/app.js");
const User = await import("../src/models/User.js");
const { requireAdmin } = await import("../src/middlewares/requireAdmin.js");
const { AppError } = await import("../src/utils/AppError.js");
const bcrypt = (await import("bcryptjs")).default;

let server;
let baseUrl;

before(async () => {
  await db.migrate.latest();
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await db.destroy();
});

function post(path, body, headers = {}) {
  return fetch(baseUrl + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validUser = { name: "Maria Júlia", email: "Maria@Exemplo.com", password: "senha1234" };

// ---------- Cadastro ----------

test("cadastro: cria jogador, normaliza e-mail e não vaza a senha", async () => {
  const res = await post("/api/auth/register", validUser);
  const data = await res.json();

  assert.equal(res.status, 201);
  assert.equal(data.user.email, "maria@exemplo.com");
  assert.equal(data.user.role, "player");
  assert.equal(typeof data.token, "string");
  assert.equal("password_hash" in data.user, false);
  assert.equal("passwordHash" in data.user, false);
  assert.equal(JSON.stringify(data).includes("senha1234"), false);
});

test("cadastro: createdAt vem em ISO 8601 UTC, igual às outras datas da API", async () => {
  const res = await post("/api/auth/register", {
    name: "Carla",
    email: "carla@exemplo.com",
    password: "senha1234",
  });
  const { user } = await res.json();

  assert.match(user.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.ok(Math.abs(Date.now() - Date.parse(user.createdAt)) < 60_000);
});

test("cadastro: e-mail repetido (mesmo com outra caixa) dá 409", async () => {
  const res = await post("/api/auth/register", { ...validUser, email: "MARIA@exemplo.com" });
  assert.equal(res.status, 409);
});

test("cadastro: nunca aceita definir o papel (role) pela API", async () => {
  const res = await post("/api/auth/register", {
    name: "Intruso",
    email: "intruso@exemplo.com",
    password: "senha1234",
    role: "admin",
  });
  const data = await res.json();

  assert.equal(res.status, 201);
  assert.equal(data.user.role, "player");
});

test("cadastro: valida os campos", async () => {
  const cases = [
    { name: "A", email: "a@a.com", password: "senha1234" },
    { name: "Fulano", email: "sem-arroba", password: "senha1234" },
    { name: "Fulano", email: "f@f.com", password: "curta" },
    { name: "Fulano", email: "f@f.com", password: "x".repeat(73) },
    { name: 123, email: "f@f.com", password: "senha1234" },
    { email: "f@f.com", password: "senha1234" },
    {},
  ];

  for (const body of cases) {
    const res = await post("/api/auth/register", body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

// ---------- Login ----------

test("login: devolve usuário e token", async () => {
  const res = await post("/api/auth/login", { email: "MARIA@exemplo.com", password: "senha1234" });
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.user.name, "Maria Júlia");
  assert.equal(typeof data.token, "string");
});

test("login: senha errada e e-mail inexistente dão a mesma resposta 401", async () => {
  const wrongPassword = await post("/api/auth/login", { email: "maria@exemplo.com", password: "errada123" });
  const unknownEmail = await post("/api/auth/login", { email: "ninguem@exemplo.com", password: "senha1234" });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.deepEqual(await wrongPassword.json(), await unknownEmail.json());
});

test("login: campos ausentes dão 400", async () => {
  const res = await post("/api/auth/login", { email: "maria@exemplo.com" });
  assert.equal(res.status, 400);
});

test("login: admin criado pelo model recebe o papel admin no token", async () => {
  await User.create({
    name: "Mestre",
    email: "mestre@exemplo.com",
    passwordHash: await bcrypt.hash("senhaDoMestre1", 4),
    role: "admin",
  });

  const res = await post("/api/auth/login", { email: "mestre@exemplo.com", password: "senhaDoMestre1" });
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.user.role, "admin");
  assert.equal(jwt.decode(data.token).role, "admin");
});

// ---------- Usuário logado (/me) ----------

test("me: sem token dá 401", async () => {
  const res = await fetch(baseUrl + "/api/auth/me");
  assert.equal(res.status, 401);
});

test("me: com token válido devolve o usuário", async () => {
  const login = await post("/api/auth/login", { email: "maria@exemplo.com", password: "senha1234" });
  const { token } = await login.json();

  const res = await fetch(baseUrl + "/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.user.email, "maria@exemplo.com");
});

test("me: token inválido, de outro segredo ou expirado dá 401", async () => {
  const forged = jwt.sign({ sub: 1, role: "admin" }, "outro-segredo");
  const expired = jwt.sign({ sub: 1, role: "player" }, "segredo-de-teste", { expiresIn: -10 });

  for (const token of ["lixo", forged, expired]) {
    const res = await fetch(baseUrl + "/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 401);
  }
});

test("me: cabeçalho sem 'Bearer' dá 401", async () => {
  const login = await post("/api/auth/login", { email: "maria@exemplo.com", password: "senha1234" });
  const { token } = await login.json();

  const res = await fetch(baseUrl + "/api/auth/me", { headers: { Authorization: token } });
  assert.equal(res.status, 401);
});

// ---------- Erros gerais ----------

test("JSON malformado dá 400 e rota inexistente dá 404, ambos em JSON", async () => {
  const bad = await post("/api/auth/login", "{ isto nao e json");
  assert.equal(bad.status, 400);
  assert.equal(typeof (await bad.json()).error, "string");

  const missing = await fetch(baseUrl + "/api/nao-existe");
  assert.equal(missing.status, 404);
  assert.equal(typeof (await missing.json()).error, "string");
});

// ---------- Middleware requireAdmin ----------

test("requireAdmin: barra jogador e deixa o mestre passar", () => {
  let received;
  requireAdmin({ user: { id: 1, role: "player" } }, {}, (arg) => (received = arg));
  assert.ok(received instanceof AppError);
  assert.equal(received.status, 403);

  received = "nao-chamado";
  requireAdmin({ user: { id: 2, role: "admin" } }, {}, (arg) => (received = arg));
  assert.equal(received, undefined);

  received = "nao-chamado";
  requireAdmin({}, {}, (arg) => (received = arg));
  assert.ok(received instanceof AppError);
});