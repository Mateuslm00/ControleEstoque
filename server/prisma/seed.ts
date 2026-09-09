import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const name = process.env.ADMIN_BOOTSTRAP_NAME || "Administrador";
  const token = process.env.ADMIN_BOOTSTRAP_TOKEN;

  if (!email || !token) {
    console.log(
      "ADMIN_BOOTSTRAP_EMAIL e ADMIN_BOOTSTRAP_TOKEN nao definidos. Nenhum admin sera criado."
    );
    return;
  }

  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) {
    console.log("Ja existe um admin. Seed nao ira criar outro. Remova ADMIN_BOOTSTRAP_TOKEN do .env.");
    return;
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    console.log("Email de bootstrap ja cadastrado. Abortando.");
    return;
  }

  // Senha inicial aleatoria de uso unico - deve ser trocada no primeiro login.
  const initialPassword = randomBytes(18).toString("base64url");
  const passwordHash = await argon2.hash(initialPassword, { type: argon2.argon2id });

  const admin = await prisma.user.create({
    data: { name, email, passwordHash, role: "ADMIN", status: "ACTIVE", mustChangePassword: true },
  });

  console.log("=================================================");
  console.log("Admin criado com sucesso:");
  console.log(`  email: ${admin.email}`);
  console.log(`  senha inicial (anote e troque no primeiro login): ${initialPassword}`);
  console.log("Remova ADMIN_BOOTSTRAP_TOKEN/EMAIL/NAME do .env agora.");
  console.log("=================================================");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
