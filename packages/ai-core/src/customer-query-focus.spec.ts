import { AiIntent } from "@solidchat/shared";
import {
  extractCustomerServiceQuery,
  hasCustomerServiceTopic,
  hasOutOfScopeTechnicalRequest,
  shouldPrioritizeCustomerServiceSubrequest,
} from "./customer-query-focus";

describe("customer-query-focus", () => {
  it("detects a mixed customer-service and coding request", () => {
    const message =
      "Saya mau deposit untuk akun Gold Futures, tapi sebelum itu buatkan script Python untuk menghitung Moving Average 50 hari.";

    expect(hasCustomerServiceTopic(message)).toBe(true);
    expect(hasOutOfScopeTechnicalRequest(message)).toBe(true);
    expect(shouldPrioritizeCustomerServiceSubrequest(message, AiIntent.DEPOSIT)).toBe(true);
  });

  it("extracts the customer-service clause for retrieval when a coding request is appended", () => {
    const message =
      "Saya mau deposit untuk akun Gold Futures, tapi sebelum itu buatkan script Python untuk menghitung Moving Average 50 hari.";

    expect(extractCustomerServiceQuery(message, AiIntent.DEPOSIT)).toBe("Saya mau deposit untuk akun Gold Futures");
  });

  it("leaves ordinary customer-service questions untouched", () => {
    const message = "Berapa minimal deposit akun Gold Futures?";
    expect(extractCustomerServiceQuery(message, AiIntent.DEPOSIT)).toBe(message);
  });
});
