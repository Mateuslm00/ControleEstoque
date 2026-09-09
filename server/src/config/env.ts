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

  CORS_ORIGINS: z.string().min(1),

  ADMIN_BOOTSTRAP_TOKEN: z.string().optional().default(""),
  ADMIN_BOOTSTRAP_EMAIL: z.string().optional().default(""),
  ADMIN_BOOTSTRAP_NAME: z.string().optional().default(""),

  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("Estoque Pimentel <no-reply@localhost>"),
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
