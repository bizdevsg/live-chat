import { asksForHuman, directlyAsksForHuman, resolveHandoffAction } from "./handoff-override";

const resolve = (message: string, classifierAction: "NONE" | "OFFER" | "TRANSFER" | "OUT_OF_SCOPE", evidenceCount = 3) =>
  resolveHandoffAction({ classifierAction, evidenceCount, message, history: [] }).finalAction;

describe("handoff-override: explicit request for a person", () => {
  it("recognizes targets with the -nya suffix", () => {
    expect(asksForHuman("saya mau ngobrol langsung sama petugasnya aja")).toBe(true);
    expect(asksForHuman("tolong sambungkan ke csnya")).toBe(true);
    expect(asksForHuman("saya mau bicara dengan CS")).toBe(true);
  });

  it("transfers the screenshot message whatever the classifier said, even with evidence", () => {
    const message = "makasih infonya. saya mau ngobrol langsung sama petugasnya aja deh biar lebih jelas";
    expect(resolve(message, "TRANSFER")).toBe("TRANSFER");
    expect(resolve(message, "OFFER")).toBe("TRANSFER");
    expect(resolve(message, "NONE")).toBe("TRANSFER");
  });

  it("does not transfer when the want is negated", () => {
    expect(directlyAsksForHuman("saya gak mau bicara sama CS, cukup kamu aja")).toBe(false);
    expect(resolve("saya tidak mau ngobrol dengan petugas", "NONE")).toBe("NONE");
  });

  it("does not force a transfer for questions about agents or ordinary questions", () => {
    expect(resolve("apakah chat dengan agent bisa 24 jam?", "NONE")).toBe("NONE");
    expect(resolve("jam kerja CS kapan ya?", "NONE")).toBe("NONE");
    expect(resolve("minimal deposit akun prime berapa?", "NONE")).toBe("NONE");
  });

  it("still overrides an unrequested classifier TRANSFER when evidence exists", () => {
    expect(resolve("gabisa login", "TRANSFER")).toBe("NONE");
  });
});
