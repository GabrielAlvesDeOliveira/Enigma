import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as User from "../models/User.js";
import { AppError } from "../utils/AppError.js";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
const TOKEN_EXPIRES_IN = "8h";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Usado para gastar o mesmo tempo quando o e-mail não existe,
// evitando que a resposta revele quais e-mails estão cadastrados.
const DUMMY_HASH = bcrypt.hashSync("senha-de-mentira", ROUNDS);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Defina JWT_SECRET no .env antes de usar a autenticação.");
  }
  return secret;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function validateRegisterInput({ name, email, password }) {
  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
    throw new AppError(400, "Informe nome, e-mail e senha.");
  }

  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 80) {
    throw new AppError(400, "O nome deve ter entre 2 e 80 caracteres.");
  }

  const cleanEmail = normalizeEmail(email);
  if (cleanEmail.length > 255 || !EMAIL_REGEX.test(cleanEmail)) {
    throw new AppError(400, "E-mail inválido.");
  }

  // O bcrypt só considera os primeiros 72 bytes da senha.
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    throw new AppError(400, "A senha deve ter entre 8 e 72 caracteres.");
  }

  return { name: cleanName, email: cleanEmail, password };
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: TOKEN_EXPIRES_IN,
  });
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    return { id: Number(payload.sub), role: payload.role };
  } catch {
    throw new AppError(401, "Token inválido ou expirado.");
  }
}

// Quem se cadastra pela API sempre vira jogador. O mestre vem do seed.
export async function register(input) {
  const { name, email, password } = validateRegisterInput(input ?? {});

  if (await User.findByEmail(email)) {
    throw new AppError(409, "Este e-mail já está cadastrado.");
  }

  const passwordHash = await bcrypt.hash(password, ROUNDS);

  let row;
  try {
    row = await User.create({ name, email, passwordHash, role: "player" });
  } catch (err) {
    // Dois cadastros simultâneos com o mesmo e-mail: o banco barra o segundo.
    if (err.code === "23505" || err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new AppError(409, "Este e-mail já está cadastrado.");
    }
    throw err;
  }

  return { user: User.toPublicUser(row), token: signToken(row) };
}

export async function login(input) {
  const { email, password } = input ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    throw new AppError(400, "Informe e-mail e senha.");
  }

  const row = await User.findByEmail(normalizeEmail(email));
  const matches = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);

  if (!row || !matches) {
    throw new AppError(401, "E-mail ou senha inválidos.");
  }

  return { user: User.toPublicUser(row), token: signToken(row) };
}

export async function getCurrentUser(id) {
  const row = await User.findById(id);
  if (!row) throw new AppError(401, "Usuário não encontrado.");
  return User.toPublicUser(row);
}