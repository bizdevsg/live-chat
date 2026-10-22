import { WhatsAppInboxService } from "./whatsapp-inbox.service";

describe("WhatsAppInboxService", () => {
  function setup() {
    const prisma = {
      whatsAppConnection: {
        findUnique: jest.fn().mockResolvedValue({ sessionName: "solidchat-org", status: "CONNECTED" }),
      },
    };
    const waha = {
      getChatsOverview: jest.fn().mockResolvedValue([
        { id: "628123456789@c.us", name: "Budi WAHA", picture: "https://example.test/avatar.jpg", lastMessage: { id: "message-1", timestamp: 100, body: "Halo" }, _chat: { unreadCount: 2 } },
        { id: "120363@g.us", name: "Grup internal" },
      ]),
      getContact: jest.fn().mockResolvedValue({ id: "628123456789@c.us", number: "628123456789", pushname: "Budi WAHA" }),
      getContactPicture: jest.fn().mockResolvedValue({ profilePictureURL: "https://example.test/avatar.jpg" }),
      getChatMessages: jest.fn().mockResolvedValue([{ id: "message-1", timestamp: 100, fromMe: false, body: "Halo" }]),
      sendText: jest.fn().mockResolvedValue({ id: "message-2", timestamp: 101, fromMe: true, body: "Hai" }),
      markChatRead: jest.fn().mockResolvedValue({ ids: ["message-1"] }),
    };
    return { service: new WhatsAppInboxService(prisma as never, waha as never), waha };
  }

  it("uses WAHA chat identity and excludes groups from the dedicated inbox", async () => {
    const { service } = setup();
    await expect(service.listChats("org-1")).resolves.toEqual([
      expect.objectContaining({ id: "628123456789@c.us", name: "Budi WAHA", phoneNumber: "628123456789", unreadCount: 2 }),
    ]);
  });

  it("sends a manual text directly through WAHA", async () => {
    const { service, waha } = setup();
    await service.sendText("org-1", "628123456789@c.us", "Hai");
    expect(waha.sendText).toHaveBeenCalledWith("solidchat-org", "628123456789@c.us", "Hai");
  });
});
