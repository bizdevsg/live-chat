import { z } from "zod";

/**
 * z.coerce.boolean() is a footgun for env vars: it just runs JS `Boolean(value)`,
 * so a literal string "false" (non-empty) coerces to `true`. That bug previously made
 * AI_MOCK_MODE=false in .env evaluate to `true`, silently forcing every conversation
 * onto MockAiProvider even with AI_PROVIDER=openai and a valid OPENAI_API_KEY set.
 * This helper parses "true"/"1" as true and everything else (including "false") as false.
 */
function booleanEnv(defaultValue: boolean) {
  return z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined) return defaultValue;
      if (typeof value === "boolean") return value;
      return value.trim().toLowerCase() === "true" || value.trim() === "1";
    });
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  APP_URL: z.string().default("http://localhost:3000"),
  API_URL: z.string().default("http://localhost:4000"),
  WIDGET_URL: z.string().default("http://localhost:3001"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  MARKET_DATA_WS_ENABLED: booleanEnv(true),
  MARKET_DATA_WS_URL: z.string().default("wss://wsprc.royalassetindo.co.id"),
  MARKET_DATA_WS_SUBSCRIBE_MESSAGE: z.string().optional(),
  MARKET_DATA_WS_RECONNECT_MS: z.coerce.number().default(5000),
  MARKET_DATA_MAX_QUOTE_AGE_MS: z.coerce.number().default(30000),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  VISITOR_TOKEN_SECRET: z.string().min(16).optional(),
  CUSTOMER_IDENTITY_JWT_SECRET: z.string().optional(),
  CUSTOMER_IDENTITY_ISSUER: z.string().default("sg-berjangka.com"),
  CUSTOMER_IDENTITY_AUDIENCE: z.string().default("solidchat"),

  // Model names are fixed constants in @solidchat/shared (AI_MODELS) — there is no mock
  // provider anymore, so the API refuses to boot without a real OpenAI key.
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required — there is no mock AI mode"),

  CRM_PROVIDER: z.enum(["mock", "rest"]).default("mock"),
  CRM_BASE_URL: z.string().optional(),
  CRM_API_KEY: z.string().optional(),
  CRM_INBOUND_API_KEY: z.string().optional(),

  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().default("solidchat"),
  S3_SECRET_KEY: z.string().default("solidchat-secret"),
  S3_BUCKET: z.string().default("solidchat"),
  S3_FORCE_PATH_STYLE: booleanEnv(true),

  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be at least 32 chars"),
  COOKIE_DOMAIN: z.string().default("localhost"),
  CORS_ALLOWED_ORIGINS: z.string().default(""),

  DEFAULT_TIMEZONE: z.string().default("Asia/Jakarta"),
  DEFAULT_LANGUAGE: z.string().default("id"),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${message}`);
  }
  return parsed.data;
}
