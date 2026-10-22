import { WhatsAppInboundService } from "./whatsapp-inbound.service";

describe("WhatsAppInboundService", () => {
  function setup() {
    const prisma = {
      whatsAppConnection: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const connections = {
      normalizeStatus: jest.fn((status?: string) => status === "WORKING" ? "CONNECTED" : status ?? "CONNECTING"),
      phoneFromWhatsAppId: jest.fn(() => "628123456789"),
    };
    return { service: new WhatsAppInboundService(prisma as never, connections as never), prisma };
  }

  it("updates the local connection status from WAHA", async () => {
    const { service, prisma } = setup();
    await service.handle({ event: "session.status", session: "solidchat-org", me: { id: "628123456789@c.us" }, payload: { status: "WORKING" } });
    expect(prisma.whatsAppConnection.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { sessionName: "solidchat-org" },
      data: expect.objectContaining({ status: "CONNECTED", phoneNumber: "628123456789" }),
    }));
  });

  it("does not persist messages or trigger the Live Chat/AI pipeline", async () => {
    const { service, prisma } = setup();
    await service.handle({ event: "message", session: "solidchat-org", payload: { from: "628123456789@c.us", body: "Halo" } });
    expect(prisma.whatsAppConnection.updateMany).not.toHaveBeenCalled();
  });

  it("does not mirror WAHA acknowledgement events into Live Chat messages", async () => {
    const { service, prisma } = setup();
    await service.handle({ event: "message.ack", session: "solidchat-org", payload: { ack: 3 } });
    expect(prisma.whatsAppConnection.updateMany).not.toHaveBeenCalled();
  });
});
