import * as roomService from "../services/roomService.js";
import { parseId } from "../utils/parseId.js";

const roomId = (req) => parseId(req.params.id, "Sala não encontrada.");

export async function create(req, res) {
  const room = await roomService.createRoom(req.user.id);
  res.status(201).json({ room });
}

export async function join(req, res) {
  const room = await roomService.joinRoom(req.user, req.body?.code);
  res.json({ room });
}

export async function show(req, res) {
  const room = await roomService.getRoomState(roomId(req), req.user);
  res.json({ room });
}

export async function start(req, res) {
  const room = await roomService.startRoom(roomId(req), req.user.id);
  res.json({ room });
}

export async function cancel(req, res) {
  const room = await roomService.cancelRoom(roomId(req), req.user.id);
  res.json({ room });
}

export async function leave(req, res) {
  const result = await roomService.leaveRoom(roomId(req), req.user);
  res.json(result);
}
