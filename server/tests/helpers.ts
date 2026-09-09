import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { hashPassword } from "../src/shared/security/password.js";
import type { FastifyInstance } from "fastify";

export async function makeApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

/** Limpa todas as tabelas de negocio (mantem estrutura) entre testes. */
export async function resetDb(): Promise<void> {
  await prisma.saleItemLotConsumption.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.quoteItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.emailJob.deleteMany();
  await prisma.stockLot.deleteMany();
  await prisma.stockEntryItem.deleteMany();
  await prisma.stockEntry.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.material.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
}

export async function createUser(params: { email: string; password: string; role: "ADMIN" | "OPERACIONAL" | "LEITURA" }) {
  const passwordHash = await hashPassword(params.password);
  return prisma.user.create({
    data: { name: params.email, email: params.email, passwordHash, role: params.role },
  });
}

/** Faz login via injection e retorna o cookie de sessao pronto para uso em outras requisicoes. */
export async function loginAndGetCookie(app: FastifyInstance, email: string, password: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  const cookieHeader = res.cookies.find((c) => c.name === "sid");
  if (!cookieHeader) throw new Error(`Login falhou: ${res.body}`);
  return `sid=${cookieHeader.value}`;
}

export async function getCsrfToken(app: FastifyInstance, cookie: string): Promise<{ token: string; cookie: string }> {
  const res = await app.inject({ method: "GET", url: "/auth/csrf-token", headers: { cookie } });
  const body = JSON.parse(res.body);
  const csrfCookie = res.cookies.find((c) => c.name === "_csrf");
  const combinedCookie = csrfCookie ? `${cookie}; _csrf=${csrfCookie.value}` : cookie;
  return { token: body.csrfToken, cookie: combinedCookie };
}
