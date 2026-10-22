import { createHmac } from "node:crypto";
import { WhatsAppController } from "./whatsapp.controller";

describe("WhatsAppController webhook", () => {
  const secret = "test-waha-webhook-secret-at-least-32-chars";

  function setup() {
    const inbound = { handle: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn((key: string) => key === "WAHA_WEBHOOK_HMAC_KEY" ? secret : undefined) };
    return {
      controller: new WhatsAppController({} as never, inbound as never, {} as never, config as never),
      inbound,
    };
  }

  it("accepts a valid HMAC-SHA512 over the raw body", async () => {
    const { controller, inbound } = setup();
    const event = { event: "message", session: "solidchat-org", payload: { body: "Halo" } };
    const rawBody = Buffer.from(JSON.stringify(event));
    const signature = createHmac("sha512", secret).update(rawBody).digest("hex");

    await expect(controller.webhook({ rawBody } as never, signature, event)).resolves.toEqual({ success: true, data: null });
    expect(inbound.handle).toHaveBeenCalledWith(event);
  });

  it("rejects a webhook with an invalid signature", async () => {
    const { controller, inbound } = setup();
    const event = { event: "message", session: "solidchat-org" };

    await expect(controller.webhook({ rawBody: Buffer.from(JSON.stringify(event)) } as never, "0".repeat(128), event)).rejects.toThrow(
      "Signature webhook WAHA tidak valid.",
    );
    expect(inbound.handle).not.toHaveBeenCalled();
  });
});
