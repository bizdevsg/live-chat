import { SENSITIVE_DATA_NOTICE, messageContainsCredentials, withSensitiveDataNotice } from "./sensitive-data-notice";

describe("sensitive data notice", () => {
  it("detects credentials pasted into a message", () => {
    for (const text of ["saya ga bisa login, password saya Contoh123", "pin: 123456", "OTP saya 482913", "kartu 4111 1111 1111 1111"]) {
      expect(messageContainsCredentials(text)).toBe(true);
    }
  });

  it("ignores messages that only mention the words", () => {
    for (const text of ["lupa password", "OTP tidak masuk", "berapa minimal deposit?", "akun saya terkunci"]) {
      expect(messageContainsCredentials(text)).toBe(false);
    }
  });

  it("puts the reminder first and keeps the rest of the answer", () => {
    expect(withSensitiveDataNotice("Soal login-nya, kendalanya di bagian mana?")).toBe(
      `${SENSITIVE_DATA_NOTICE}\n\nSoal login-nya, kendalanya di bagian mana?`,
    );
  });

  it("does not duplicate a reminder the answer already opens with", () => {
    const answer = "Kak, jangan kirim password di chat ya. Soal login-nya, kendalanya di mana?";
    expect(withSensitiveDataNotice(answer)).toBe(answer);
  });

  it("never quotes the pasted value", () => {
    expect(withSensitiveDataNotice("Boleh tahu kendalanya?")).not.toContain("Contoh123");
  });
});
