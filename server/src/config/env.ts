import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),

  DATABASE_URL: z.string().min(1, "DATABASE_URL e obrigatorio"),

  SESSION_SECRET: z.string().min(32, "SESSION_SECRET deve ter pelo menos 32 caracteres"),
  SESSION_ABSOLUTE_TTL_HOURS: z.coerce.number().positive().default(8),
  SESSION_IDLE_TTL_MINUTES: z.coerce.number().positive().default(30),

  COOKIE_DOMAIN: z.string().default("localhost"),
  // z.coerce.boolean() trataria qualquer string nao-vazia (incl. "false") como true;
  // por isso comparamos explicitamente com a string "true".
  COOKIE_SECURE: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  // "strict" funciona quando front e back estao no mesmo site (mesmo dominio
  // registravel, ex: app.seudominio.com + api.seudominio.com). Em hospedagem
  // gratuita com dominios completamente diferentes (ex: *.vercel.app e
  // *.onrender.com) o navegador NAO envia cookie Strict entre eles — nesse
  // caso e preciso "none" (que exige Secure, ja garantido em HTTPS). O CSRF
  // double-submit token continua sendo a defesa real contra CSRF de qualquer
  // forma, entao relaxar para "none" nao abre brecha nova.
  COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("strict"),

  CORS_ORIGINS: z.string().min(1),

  ADMIN_BOOTSTRAP_TOKEN: z.string().optional().default(""),
  ADMIN_BOOTSTRAP_EMAIL: z.string().optional().default(""),
  ADMIN_BOOTSTRAP_NAME: z.string().optional().default(""),

  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("Controle de Estoque <no-reply@localhost>"),
  EMAIL_MODE: z.enum(["dev", "live"]).default("dev"),
  FINANCE_EMAIL: z.string().optional().default(""),

  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_LOGIN_WINDOW_MINUTES: z.coerce.number().positive().default(15),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Configuracao de ambiente invalida:", parsed.error.flatten().fieldErrors);
  throw new Error("Falha ao carregar variaveis de ambiente. Verifique o .env");
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);

export const isProduction = env.NODE_ENV === "production";

// Trava de seguranca no boot: falha alto e cedo em vez de subir servidor de
// producao com config insegura (isso e mais dificil de perceber do que um
// bug funcional, porque tudo "funciona" normalmente ate alguem explorar).
if (isProduction) {
  const problems: string[] = [];
  if (!env.COOKIE_SECURE) {
    problems.push("COOKIE_SECURE deve ser 'true' em producao (cookie de sessao precisa do flag Secure em HTTPS)");
  }
  if (env.COOKIE_SAMESITE === "none" && !env.COOKIE_SECURE) {
    problems.push("COOKIE_SAMESITE=none exige COOKIE_SECURE=true (navegadores recusam None sem Secure)");
  }
  if (corsOrigins.some((o) => o.includes("localhost") || o.includes("127.0.0.1"))) {
    problems.push("CORS_ORIGINS contem localhost/127.0.0.1 em producao");
  }
  if (env.ADMIN_BOOTSTRAP_TOKEN || env.ADMIN_BOOTSTRAP_EMAIL) {
    problems.push("ADMIN_BOOTSTRAP_TOKEN/EMAIL ainda definidos no .env — remova apos criar o admin inicial");
  }
  if (env.SESSION_SECRET.length < 48) {
    problems.push("SESSION_SECRET deveria ter pelo menos 48 caracteres em producao (32 e o minimo absoluto)");
  }
  if (problems.length > 0) {
    // eslint-disable-next-line no-console
    console.error("Configuracao insegura para producao:\n - " + problems.join("\n - "));
    throw new Error("Abortando boot: configuracao de ambiente insegura para producao (ver mensagens acima)");
  }
}
