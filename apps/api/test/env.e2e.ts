process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "mysql://solidchat:solidchat_dev_password@127.0.0.1:3306/solidchat_test";
process.env.REDIS_HOST ??= "127.0.0.1";
process.env.REDIS_PORT ??= "6379";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_min_16_chars";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_min_16_chars";
process.env.VISITOR_TOKEN_SECRET ??= "test_visitor_secret_min_16_chars";
process.env.ENCRYPTION_KEY ??= "test_encryption_key_32_characters_min";
// Left empty on purpose: supertest's cookie jar talks to an in-memory server with no real
// hostname, so a Domain-scoped cookie (e.g. "localhost") would be silently dropped by the
// client-side cookie jar and every subsequent "authenticated" request would look anonymous.
process.env.COOKIE_DOMAIN ??= "";
process.env.CORS_ALLOWED_ORIGINS ??= "http://localhost:3000";
process.env.AI_PROVIDER ??= "mock";
process.env.AI_MOCK_MODE ??= "true";
