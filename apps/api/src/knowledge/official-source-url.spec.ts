import { normalizeOfficialSourceUrl, parseOfficialSourceHosts } from "./official-source-url";

describe("official source URL", () => {
  const hosts = parseOfficialSourceHosts("sg-berjangka.com");

  it("accepts the official host and its real subdomains", () => {
    expect(normalizeOfficialSourceUrl("https://sg-berjangka.com/id/register", hosts)).toBe(
      "https://sg-berjangka.com/id/register",
    );
    expect(normalizeOfficialSourceUrl("https://www.sg-berjangka.com/id/contact-us", hosts)).toBe(
      "https://www.sg-berjangka.com/id/contact-us",
    );
  });

  it("normalizes an empty value to null", () => {
    expect(normalizeOfficialSourceUrl("  ", hosts)).toBeNull();
    expect(normalizeOfficialSourceUrl(null, hosts)).toBeNull();
  });

  it.each([
    "http://sg-berjangka.com/id/register",
    "https://sg-berjangka.com.example.com/id/register",
    "https://evil-sg-berjangka.com/id/register",
    "https://user:password@sg-berjangka.com/id/register",
  ])("rejects an unsafe or unofficial URL: %s", (url) => {
    expect(() => normalizeOfficialSourceUrl(url, hosts)).toThrow();
  });
});
