import "dotenv/config";

const BASE_URL = (process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, "");

function fail(message) {
  console.error(`Erro: ${message}`);
  process.exit(1);
}

async function call(method, path, { token, body } = {}) {
  let response;
  try {
    response = await fetch(BASE_URL + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    fail(`não consegui falar com a API em ${BASE_URL}. O servidor está rodando (npm run dev)?`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) fail(`${data.error || "falha na requisição"} (${response.status})`);
  return data;
}

async function loginAsMaster() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    fail("defina ADMIN_EMAIL e ADMIN_PASSWORD no .env do backend.");
  }

  const { token } = await call("POST", "/api/auth/login", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  return token;
}

function requireRoomId(value) {
  if (!/^[1-9]\d*$/.test(value ?? "")) fail("informe o número da sala. Exemplo: node scripts/dev-room.js start 5");
  return value;
}

const [command = "create", roomId] = process.argv.slice(2);

if (!["create", "start", "cancel"].includes(command)) {
  fail(`comando desconhecido: "${command}". Use create, start ou cancel.`);
}

const token = await loginAsMaster();

if (command === "create") {
  const { room } = await call("POST", "/api/rooms", { token });
  console.log("Sala criada.");
  console.log(`  Código: ${room.code}`);
  console.log(`  Número: ${room.id}`);
  console.log("Digite o código na tela 'Entrar no jogo' (com um jogador logado).");
  console.log(`Para iniciar:  node scripts/dev-room.js start ${room.id}`);
  console.log(`Para cancelar: node scripts/dev-room.js cancel ${room.id}`);
} else if (command === "start") {
  const { room } = await call("POST", `/api/rooms/${requireRoomId(roomId)}/start`, { token });
  console.log(`Sala ${room.code} (número ${room.id}) iniciada.`);
  console.log(`Termina às ${new Date(room.endsAt).toLocaleTimeString("pt-BR")}.`);
} else {
  const { room } = await call("POST", `/api/rooms/${requireRoomId(roomId)}/cancel`, { token });
  console.log(`Sala ${room.code} (número ${room.id}) cancelada.`);
}
