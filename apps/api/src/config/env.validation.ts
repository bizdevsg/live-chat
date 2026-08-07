import { z } from "zod";

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

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  VISITOR_TOKEN_SECRET: z.string().min(16).optional(),
  CUSTOMER_IDENTITY_JWT_SECRET: z.string().optional(),
  CUSTOMER_IDENTITY_ISSUER: z.string().default("sg-berjangka.com"),
  CUSTOMER_IDENTITY_AUDIENCE: z.string().default("solidchat"),

  AI_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  AI_MOCK_MODE: z.coerce.boolean().default(true),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_DEFAULT_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_CLASSIFIER_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_SUMMARY_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),

  CRM_PROVIDER: z.enum(["mock", "rest"]).default("mock"),
  CRM_BASE_URL: z.string().optional(),
  CRM_API_KEY: z.string().optional(),

  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().default("solidchat"),
  S3_SECRET_KEY: z.string().default("solidchat-secret"),
  S3_BUCKET: z.string().default("solidchat"),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be at least 32 chars"),
  COOKIE_DOMAIN: z.string().default("localhost"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001"),

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
