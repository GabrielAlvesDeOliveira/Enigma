import * as Room from "../models/Room.js";
import { publishRoomChange } from "../events/roomEvents.js";

export async function sweepOverdueRooms(now = Date.now()) {
  const overdue = await Room.findOverdue(now);
  let closed = 0;

  for (const room of overdue) {
    const changed = await Room.transition(room.id, ["in_progress"], {
      status: "finished",
      finishReason: "timeout",
      finishedAtMs: room.endsAtMs,
    });

    if (changed > 0) {
      closed++;
      publishRoomChange(room.id, "timeout");
    }
  }

  return closed;
}

export function startSweeper(intervalMs = Number(process.env.SWEEP_INTERVAL_MS) || 1000) {
  let running = false;

  const timer = setInterval(async () => {
    if (running) return; 
    running = true;
    try {
      await sweepOverdueRooms();
    } catch (err) {
      console.error("Erro ao encerrar salas com tempo esgotado:", err);
    } finally {
      running = false;
    }
  }, intervalMs);

  timer.unref?.();
  return () => clearInterval(timer);
}
