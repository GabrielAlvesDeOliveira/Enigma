import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import puzzleRoutes from "./routes/puzzleRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
// As rotas de enigmas vêm antes por serem mais específicas.
app.use("/api/rooms/:id/puzzles", puzzleRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/admin", adminRoutes);

// Sempre por último: rota inexistente e tratamento de erros.
app.use(notFound);
app.use(errorHandler);

export default app;
