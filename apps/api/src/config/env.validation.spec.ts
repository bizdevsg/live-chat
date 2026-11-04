import { validateEnv } from "./env.validation";

const base = {
  DATABASE_URL: "mysql://u:p@localhost:3306/db",
  JWT_ACCESS_SECRET: "access_secret_min_16_chars",
  JWT_REFRESH_SECRET: "refresh_secret_min_16_chars",
  ENCRYPTION_KEY: "encryption_key_with_at_least_32_characters",
};

describe("validateEnv AI provider", () => {
  it("defaults to openai and requires OPENAI_API_KEY", () => {
    expect(() => validateEnv(base)).toThrow(/OPENAI_API_KEY/);
    expect(validateEnv({ ...base, OPENAI_API_KEY: "sk-test" }).AI_PROVIDER).toBe("openai");
  });

  it("treats legacy values like 'mock' as openai", () => {
    expect(validateEnv({ ...base, AI_PROVIDER: "mock", OPENAI_API_KEY: "sk-test" }).AI_PROVIDER).toBe("openai");
  });

  it("boots without an OpenAI key when AI_PROVIDER=ollama and applies Ollama defaults", () => {
    const env = validateEnv({ ...base, AI_PROVIDER: "Ollama", OPENAI_API_KEY: "" });
    expect(env.AI_PROVIDER).toBe("ollama");
    expect(env.OLLAMA_BASE_URL).toBe("http://host.docker.internal:11434/v1");
    expect(env.OLLAMA_CHAT_MODEL).toBe("qwen2.5:14b");
    expect(env.OLLAMA_EMBEDDING_MODEL).toBe("bge-m3");
    expect(env.OLLAMA_TIMEOUT_MS).toBe(120000);
  });
});
