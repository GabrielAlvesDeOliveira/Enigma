import bcrypt from "bcryptjs";

export async function seed(knex) {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env antes de rodar o seed."
    );
  }

  const email = ADMIN_EMAIL.trim().toLowerCase();

  // Seed idempotente: se o admin já existe, não faz nada.
  const existing = await knex("users").where({ email }).first();
  if (existing) {
    console.log(`Admin ${email} já existe. Nada foi alterado.`);
    return;
  }

  const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await knex("users").insert({
    name: ADMIN_NAME || "Mestre",
    email,
    password_hash,
    role: "admin",
  });

  console.log(`Admin criado: ${email}`);
}