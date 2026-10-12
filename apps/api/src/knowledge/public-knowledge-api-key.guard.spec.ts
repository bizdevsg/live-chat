import { PublicKnowledgeApiKeyGuard } from "./public-knowledge-api-key.guard";

describe("PublicKnowledgeApiKeyGuard", () => {
  const buildContext = (key?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: key ? { "x-knowledge-api-key": key } : {} }),
      }),
    }) as never;

  it("accepts the configured API key", () => {
    const guard = new PublicKnowledgeApiKeyGuard({
      get: jest.fn().mockReturnValue("knowledge-key-123456"),
    } as never);

    expect(guard.canActivate(buildContext("knowledge-key-123456"))).toBe(true);
  });

  it("rejects a missing or invalid API key", () => {
    const guard = new PublicKnowledgeApiKeyGuard({
      get: jest.fn().mockReturnValue("knowledge-key-123456"),
    } as never);

    expect(() => guard.canActivate(buildContext())).toThrow("Public Knowledge API key tidak valid.");
    expect(() => guard.canActivate(buildContext("wrong-key"))).toThrow("Public Knowledge API key tidak valid.");
  });

  it("fails closed when the server key is not configured", () => {
    const guard = new PublicKnowledgeApiKeyGuard({ get: jest.fn() } as never);

    expect(() => guard.canActivate(buildContext("any-key"))).toThrow(
      "Public Knowledge API key belum dikonfigurasi di server.",
    );
  });

  it("falls back to the WhatsApp Assistant key when a dedicated key is empty", () => {
    const config = {
      get: jest.fn((name: string) =>
        name === "WHATSAPP_ASSISTANT_API_KEY" ? "extension-key-123456" : "",
      ),
    };
    const guard = new PublicKnowledgeApiKeyGuard(config as never);

    expect(guard.canActivate(buildContext("extension-key-123456"))).toBe(true);
  });
});
