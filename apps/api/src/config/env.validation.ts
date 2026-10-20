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

function optionalSecret(minLength: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(minLength).optional(),
  );
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  APP_URL: z.string().default("http://localhost:3000"),
  API_URL: z.string().default("http://localhost:4000"),
  WIDGET_URL: z.string().default("http://localhost:3001"),
  OFFICIAL_KNOWLEDGE_SOURCE_HOSTS: z.string().default("sg-berjangka.com"),

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

  // A single chat model is shared by every AI task. There is no mock provider anymore,
  // so the API refuses to boot without a real OpenAI key.
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required — there is no mock AI mode"),
  OPENAI_DEFAULT_MODEL: z.enum(["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"]).default("gpt-4o-mini"),
  WHATSAPP_ASSISTANT_API_KEY: z.string().min(16).optional(),
  WHATSAPP_ASSISTANT_SITE_ID: z.string().optional(),
  PUBLIC_KNOWLEDGE_API_KEY: z.string().min(16).optional(),
  PUBLIC_KNOWLEDGE_SITE_ID: z.string().optional(),

  CRM_PROVIDER: z.enum(["mock", "rest"]).default("mock"),
  CRM_BASE_URL: z.string().optional(),
  CRM_API_KEY: z.string().optional(),

  // Inbound: Clara pulling conversations via GET /api/v1/conversations (Kebutuhan API Live
  // Chat dan SSO Dashboard §4, §4.1). Prefer CRM_API_KEYS (JSON array, one credential per
  // site — least privilege). CRM_INBOUND_API_KEY/CRM_API_KEY is a legacy fallback with
  // unrestricted (all-sites) access, kept only for backward compatibility.
  CRM_API_KEYS: z.string().optional(),
  CRM_INBOUND_API_KEY: z.string().optional(),
  CRM_ALLOWED_IPS: z.string().optional(),

  // Outbound the other way: Live Chat as OAuth/OIDC *client* logging agents into the Dashboard
  // via their Clara account (Kebutuhan API Live Chat dan SSO Dashboard §4A / Bagian B). Optional —
  // when unset, GET /api/v1/auth/clara/login and /callback respond 503 SSO_NOT_CONFIGURED and the
  // regular email/password login keeps working untouched.
  CRM_SSO_ISSUER: z.string().optional(),
  CRM_SSO_CLIENT_ID: z.string().optional(),
  CRM_SSO_CLIENT_SECRET: z.string().optional(),
  // Must be the exact URL registered with Clara for this environment, e.g.
  // https://live-chat.sg-berjangka.com/api/v1/auth/clara/callback — Clara matches it exactly.
  CRM_SSO_REDIRECT_URI: z.string().optional(),
  // Comma-separated Clara roles allowed to sign in to the Dashboard this way.
  CRM_SSO_ALLOWED_ROLES: z.string().default("sales,manager,head,superadmin"),
  // Optional extra check: reject ID tokens whose organizationId claim doesn't match this value.
  CRM_SSO_ALLOWED_ORGANIZATION_ID: z.string().optional(),
  // How long a login attempt's state/nonce/PKCE verifier survives in Redis before it's
  // considered abandoned (agent closed the tab, took too long on Clara's login page, etc).
  CRM_SSO_STATE_TTL_SECONDS: z.coerce.number().default(600),
  // Internal Dashboard path the agent lands on after a successful Clara login.
  CRM_SSO_POST_LOGIN_PATH: z.string().default("/dashboard"),
  // Auto-provisioning (§ intent: agent accounts come FROM Clara — Live Chat should not need a
  // manual "create user" step first). New agents are created in this organization...
  CRM_SSO_DEFAULT_ORGANIZATION_SLUG: z.string().default("solid-gold"),
  // ...with this Clara role -> Live Chat role slug mapping ("clara_role:live_chat_role" pairs,
  // comma-separated). A Clara role allowed by CRM_SSO_ALLOWED_ROLES but missing here is treated
  // as a configuration error (login refused, not guessed).
  CRM_SSO_ROLE_MAP: z.string().default("sales:cs_agent,manager:supervisor,head:admin,superadmin:super_admin"),

  // Outbound conversation snapshots to Clara. The JSON array is keyed by the local Site.siteKey;
  // each entry carries Clara's site id and a per-environment, per-site secret.
  CLARA_WEBHOOK_URL: z.string().default("https://crm.sg-berjangka.com/api/webhooks/live-chat/events"),
  CLARA_WEBHOOK_SITE_CONFIGS: z.string().optional(),

  // Live Chat as an OIDC provider for Clara. Leaving the secret/redirect URI empty disables it.
  LIVE_CHAT_OIDC_ISSUER: z.string().optional(),
  LIVE_CHAT_OIDC_CLIENT_ID: z.string().default("clara-crm"),
  LIVE_CHAT_OIDC_CLIENT_SECRET: optionalSecret(32),
  LIVE_CHAT_OIDC_REDIRECT_URI: z.string().optional(),
  LIVE_CHAT_OIDC_CODE_TTL_SECONDS: z.coerce.number().int().min(30).max(120).default(120),
  LIVE_CHAT_OIDC_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(600).default(300),
  LIVE_CHAT_OIDC_ALLOWED_ROLES: z.string().default("cs_agent,supervisor,admin,super_admin"),

  // Agent-bound extension tokens use a separate key and audience from dashboard sessions.
  EXTENSION_TOKEN_SECRET: optionalSecret(32),
  EXTENSION_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  WHATSAPP_ASSISTANT_ALLOW_LEGACY_API_KEY: booleanEnv(false),

  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  // Browser-reachable object-store endpoint used ONLY when signing download URLs. In Docker the
  // API reaches MinIO over the internal network (S3_ENDPOINT=http://minio:9000), but the <img>
  // tags that load those URLs run in the operator's / visitor's browser and must hit a published
  // host. Leave empty to reuse S3_ENDPOINT (correct when the API and browsers share one endpoint).
  S3_PUBLIC_ENDPOINT: z.string().default(""),
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
