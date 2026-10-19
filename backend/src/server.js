import "dotenv/config";
import http from "node:http";
import app from "./app.js";
import { attachSockets } from "./sockets/index.js";
import { startSweeper } from "./services/roomSweeper.js";

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
attachSockets(server);
startSweeper();
console.log("Tempo real (Socket.IO) ativo.");

server.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
