import fs from "node:fs";
import path from "node:path";

// Carrega .env.test manualmente (sem depender de dotenv como dependencia de producao).
const envPath = path.resolve(__dirname, "../.env.test");
const content = fs.readFileSync(envPath, "utf-8");
for (const line of content.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + 1).trim();
  process.env[key] = value;
}
