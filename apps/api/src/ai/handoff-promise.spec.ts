import { promisesHandoff } from "./handoff-override";

describe("promisesHandoff", () => {
  it("detects a plain promise to connect the customer to a person", () => {
    expect(promisesHandoff("Tentu, kak! Saya akan menghubungkan kakak langsung dengan tim customer service kami. Mohon tunggu sebentar ya.")).toBe(true);
    expect(promisesHandoff("Baik kak, aku hubungkan ke petugas kami ya.")).toBe(true);
    expect(promisesHandoff("Syaratnya sudah saya jelaskan di atas.\nSaya teruskan ke agent sekarang.")).toBe(true);
  });

  it("ignores questions, offers, conditions and negations", () => {
    expect(promisesHandoff("Mau aku hubungkan ke petugas kami, kak?")).toBe(false);
    expect(promisesHandoff("Kalau kakak mau, aku bisa menghubungkan kakak ke agent.")).toBe(false);
    expect(promisesHandoff("Maaf kak, aku tidak bisa menghubungkan ke petugas saat ini.")).toBe(false);
    expect(promisesHandoff("Apakah kakak ingin dihubungkan dengan customer service?")).toBe(false);
  });

  it("ignores ordinary answers and ways for the customer to reach staff", () => {
    expect(promisesHandoff("Minimal deposit akun Prime adalah USD 500.")).toBe(false);
    expect(promisesHandoff("Kakak bisa menghubungi customer service di jam kerja.")).toBe(false);
    expect(promisesHandoff("Pengajuan dilakukan Senin sampai Jumat pukul 08.00 sampai 15.00 WIB.")).toBe(false);
  });
});
