import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);

// Sempre por último: rota inexistente e tratamento de erros.
app.use(notFound);
app.use(errorHandler);

export default app;