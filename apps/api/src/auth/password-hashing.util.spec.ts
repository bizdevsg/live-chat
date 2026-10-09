import { hashPassword, verifyPassword } from "./password-hashing.util";

describe("password hashing", () => {
  it("uses Argon2id with a unique embedded salt for every hash", async () => {
    const password = "simplepass";
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).not.toBe(second);
    expect(first.startsWith("$argon2id$v=19$")).toBe(true);
    expect(second.startsWith("$argon2id$v=19$")).toBe(true);
    expect(first.split("$")[4]).not.toBe(second.split("$")[4]);
    await expect(verifyPassword(first, password)).resolves.toBe(true);
    await expect(verifyPassword(second, password)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const passwordHash = await hashPassword("correct-password");

    await expect(verifyPassword(passwordHash, "wrong-password")).resolves.toBe(false);
  });
});
