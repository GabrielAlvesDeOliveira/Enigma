import { Server } from "socket.io";
import { verifyToken } from "../services/authService.js";
import { getRoomState, loadAccessibleRoom } from "../services/roomService.js";
import { toAttemptView } from "../services/historyService.js";
import * as PuzzleAttempt from "../models/PuzzleAttempt.js";
import { roomEvents, ROOM_CHANGED, ATTEMPT_CREATED } from "../events/roomEvents.js";
import { AppError } from "../utils/AppError.js";
import { parseId } from "../utils/parseId.js";

const SYSTEM_USER = { id: 0, role: "admin" };
const MAX_SUBSCRIPTIONS = 10;

const roomChannel = (roomId) => `room:${roomId}`;
const masterChannel = (roomId) => `room:${roomId}:master`;

const subscriptionCount = (socket) =>
  [...socket.rooms].filter((name) => name.startsWith("room:") && !name.endsWith(":master")).length;

function toAckError(err) {
  if (err instanceof AppError) return { ok: false, status: err.status, error: err.message };
  console.error(err);
  return { ok: false, status: 500, error: "Erro interno do servidor." };
}

export function attachSockets(httpServer, { corsOrigin = process.env.CORS_ORIGIN } = {}) {
  const origin = corsOrigin ? corsOrigin.split(",").map((item) => item.trim()) : "*";

  const io = new Server(httpServer, {
    cors: { origin },
    maxHttpBufferSize: 1e4, 
  });

  io.use((socket, next) => {
    try {
      socket.data.user = verifyToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("room:subscribe", async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};

      try {
        const roomId = parseId(payload?.roomId, "Sala não encontrada.");

        if (!socket.rooms.has(roomChannel(roomId)) && subscriptionCount(socket) >= MAX_SUBSCRIPTIONS) {
          throw new AppError(429, "Inscrições demais em salas ao mesmo tempo.");
        }

        await loadAccessibleRoom(roomId, socket.data.user);
        socket.join(roomChannel(roomId));
        if (socket.data.user.role === "admin") socket.join(masterChannel(roomId));

        reply({ ok: true, room: await getRoomState(roomId, socket.data.user) });
      } catch (err) {
        reply(toAckError(err));
      }
    });

    socket.on("room:unsubscribe", (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};

      try {
        const roomId = parseId(payload?.roomId, "Sala não encontrada.");
        socket.leave(roomChannel(roomId));
        socket.leave(masterChannel(roomId));
        reply({ ok: true });
      } catch (err) {
        reply(toAckError(err));
      }
    });
  });

  const onRoomChanged = async ({ roomId, type, userId }) => {
    try {
      if (type === "player_left" && userId != null) {
        const sockets = await io.in(roomChannel(roomId)).fetchSockets();
        for (const s of sockets) {
          if (s.data.user.role === "player" && s.data.user.id === userId) {
            s.leave(roomChannel(roomId));
          }
        }
      }

      const room = await getRoomState(roomId, SYSTEM_USER);
      io.to(roomChannel(roomId)).emit("room:updated", { type, room });
    } catch (err) {
      console.error("Erro ao transmitir mudança da sala:", err);
    }
  };

  const onAttemptCreated = async ({ roomId, attemptId }) => {
    try {
      const attempt = await PuzzleAttempt.findById(attemptId);
      if (attempt) io.to(masterChannel(roomId)).emit("attempt:new", { attempt: toAttemptView(attempt) });
    } catch (err) {
      console.error("Erro ao transmitir tentativa:", err);
    }
  };

  roomEvents.on(ROOM_CHANGED, onRoomChanged);
  roomEvents.on(ATTEMPT_CREATED, onAttemptCreated);

  return {
    io,
    close: async () => {
      roomEvents.off(ROOM_CHANGED, onRoomChanged);
      roomEvents.off(ATTEMPT_CREATED, onAttemptCreated);
      await io.close();
    },
  };
}
