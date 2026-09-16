import { MarketDataService } from "./market-data.service";

describe("MarketDataService", () => {
  function createService() {
    return new MarketDataService({ get: jest.fn().mockReturnValue(undefined) } as never);
  }

  function seedXul10(service: MarketDataService) {
    (service as unknown as { quotes: Map<string, unknown> }).quotes.set("XUL10", {
      symbol: "XUL10",
      bid: 4324.84,
      ask: 4325.64,
      last: 4325.24,
      updatedAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    });
  }

  it("does not turn a top-up follow-up into a previous market quote", () => {
    const service = createService();
    seedXul10(service);

    expect(service.getRealtimePriceAnswer("kalo misalnya gua topup $1 bisa kah?", "Harga XUL10 saat ini adalah 4325.")).toBeNull();
  });

  it("still returns a quote for an explicit XUL10 price question", () => {
    const service = createService();
    seedXul10(service);

    expect(service.getRealtimePriceAnswer("Berapa harga XUL10 saat ini?")).toContain("XUL10");
  });
});
