import { sanitizePlainText, truncate } from "./sanitize";

describe("sanitizePlainText", () => {
  it("strips HTML tags", () => {
    expect(sanitizePlainText("<script>alert(1)</script>Halo")).toBe("alert(1)Halo");
  });

  it("strips non-printable control characters but keeps newlines and tabs", () => {
    const withControlChars = "Halo\x07 dunia\nbaris kedua\ttab\x1b";
    expect(sanitizePlainText(withControlChars)).toBe("Halo dunia\nbaris kedua\ttab");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizePlainText("   halo   ")).toBe("halo");
  });

  it("leaves ordinary text untouched", () => {
    expect(sanitizePlainText("Bagaimana cara daftar akun?")).toBe("Bagaimana cara daftar akun?");
  });
});

describe("truncate", () => {
  it("leaves short strings untouched", () => {
    expect(truncate("halo", 10)).toBe("halo");
  });

  it("truncates long strings and appends an ellipsis", () => {
    expect(truncate("halo dunia", 4)).toBe("halo…");
  });
});
