/**
 * importLegacyData.ts
 * -----------------------------------------------------------------------
 * Migracao de dados unica, feita em 2026-09-09: traz para o banco de
 * producao os dados que existiam no sistema antigo (frontend puro, sem
 * backend), lidos de
 * C:\Users\Mateus Lima\Documents\arquivos principal\Projeto pimentel\estoque-app-organizado\estoque-app-organizado\src\data\seedData.js
 *
 * Depois de rodar uma vez com sucesso, este arquivo nao precisa rodar de
 * novo — nao ha problema em apagar, mas foi deixado aqui documentado como
 * registro de onde os dados de Unidades/Fornecedores/Materiais iniciais
 * vieram.
 *
 * Rodar com: npx tsx --env-file=.env prisma/importLegacyData.ts
 * -----------------------------------------------------------------------
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_UNITS = [
  { name: "ISV Papicu", cnpj: null },
  { name: "ISV Oliveira Paiva", cnpj: null },
  { name: "ISV Venna", cnpj: null },
  { name: "Venna", cnpj: null },
  { name: "Multicordis Centrocardio", cnpj: null },
  { name: "Multicordis Unicordis", cnpj: null },
  { name: "Admed", cnpj: null },
  { name: "Callcenter", cnpj: null },
  { name: "Angiocursos", cnpj: null },
  { name: "Sauvtech", cnpj: null },
  { name: "Sauv Soluções", cnpj: null },
];

const LEGACY_SUPPLIERS = [
  { name: "MedSupply Distribuidora", cnpj: "12.345.678/0001-90", phone: "(85) 3222-1100", contactPerson: "Marina Alves", email: "vendas@medsupply.com" },
  { name: "CardioMat Comércio", cnpj: "98.765.432/0001-11", phone: "(85) 3233-4455", contactPerson: "Rafael Souza", email: "contato@cardiomat.com" },
  { name: "Nordeste Hospitalar", cnpj: "45.678.912/0001-22", phone: "(85) 3244-8899", contactPerson: "Camila Torres", email: "comercial@nordestehosp.com" },
];

const DEFAULT_MARKUP = 30;

const LEGACY_MATERIALS = [
  { name: "Luva de Procedimento M", type: "Material Médico", group: "Descartável", unit: "cx", markup: 35, sku: "LUVA-PROC-M" },
  { name: "Seringa 10ml", type: "Material Médico", group: "Descartável", unit: "un", markup: 40, sku: "SERINGA-10ML" },
  { name: "Álcool 70% 1L", type: "Limpeza", group: "Consumível", unit: "un", markup: DEFAULT_MARKUP, sku: "ALCOOL-70-1L" },
];

async function main() {
  console.log("Importando Unidades/Clientes...");
  for (const unit of LEGACY_UNITS) {
    // Client.name nao e unique no schema, entao nao da pra usar upsert
    // direto — verifica manualmente antes de criar (idempotente).
    const existing = await prisma.client.findFirst({ where: { name: unit.name } });
    if (!existing) {
      await prisma.client.create({ data: { name: unit.name, cnpj: unit.cnpj } });
    }
  }

  console.log("Importando Fornecedores...");
  for (const supplier of LEGACY_SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { cnpj: supplier.cnpj },
      update: {},
      create: supplier,
    });
  }

  console.log("Importando Materiais...");
  for (const material of LEGACY_MATERIALS) {
    await prisma.material.upsert({
      where: { sku: material.sku },
      update: {},
      create: material,
    });
  }

  console.log("Importacao concluida.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
