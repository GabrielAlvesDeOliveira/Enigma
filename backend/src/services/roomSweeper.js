import * as Room from "../models/Room.js";
import { publishRoomChange } from "../events/roomEvents.js";

// Encerra as salas cujo tempo acabou e avisa quem está conectado.
// Devolve quantas salas foram encerradas.
export async function sweepOverdueRooms(now = Date.now()) {
  const overdue = await Room.findOverdue(now);
  let closed = 0;

  for (const room of overdue) {
    const changed = await Room.transition(room.id, ["in_progress"], {
      status: "finished",
      finishReason: "timeout",
      finishedAtMs: room.endsAtMs,
    });

    // 0 significa que outra parte do sistema encerrou a sala antes.
    if (changed > 0) {
      closed++;
      publishRoomChange(room.id, "timeout");
    }
  }

  return closed;
}

// Roda a checagem repetidamente. Como ela olha o banco, continua certa
// mesmo se o servidor reiniciar no meio de uma partida.
// Devolve uma função que para a checagem.
export function startSweeper(intervalMs = Number(process.env.SWEEP_INTERVAL_MS) || 1000) {
  let running = false;

  const timer = setInterval(async () => {
    if (running) return; // não empilha execuções se o banco estiver lento
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
