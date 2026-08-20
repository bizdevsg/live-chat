/**
 * End-to-end check against the REAL knowledge base in MySQL — no hardcoded KB text anywhere.
 * Run it inside the already-running api container, no rebuild needed:
 *
 *   docker compose cp packages/ai-core/test-grounding.mjs api:/repo/packages/ai-core/test-grounding.mjs
 *   docker compose exec api node /repo/packages/ai-core/test-grounding.mjs
 *
 * Optionally pass your own questions (otherwise the defaults below are used):
 *   docker compose exec api node /repo/packages/ai-core/test-grounding.mjs "biaya swap berapa?" "jam trading kapan?"
 *
 * What it does, per question:
 *   1. Retrieves evidence from the live database using the SAME KnowledgeRetriever the API uses
 *      (real embeddings, real ACTIVE/PUBLISHED filtering) — so whatever KB you have today,
 *      including documents added after this file was written, is what gets tested.
 *   2. Drafts an answer from that evidence.
 *   3. Runs the OLD and the NEW grounding-review prompt over the same draft, several times each,
 *      and reports how often each verdict lets the answer through.
 *
 * The reviewer prompts are the only thing written out in this file, because comparing old vs new
 * is the entire point. Everything factual comes from your database.
 */
import { createRequire } from "node:module";

const require = createRequire("/repo/packages/ai-core/");
const { KnowledgeRetriever, OpenAiProvider } = require("/repo/packages/ai-core/dist/index.js");
const { PrismaClient } = require("@solidchat/database");
const OpenAI = require("openai").default ?? require("openai");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY tidak ada di environment container ini.");
  process.exit(1);
}

const MODEL = "gpt-4o-mini";
const RUNS = 3;

const questions =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : [
        "Minimal deposit berapa di akun mini??",
        "Ada biaya swap gak sih disini??",
        "ada akun jenis apa saja disini??",
      ];

const prisma = new PrismaClient();
const client = new OpenAI({ apiKey, timeout: 60000, maxRetries: 2 });
const provider = new OpenAiProvider({
  apiKey,
  classifierModel: MODEL,
  answerModel: MODEL,
  summaryModel: MODEL,
  suggestedReplyModel: MODEL,
  embeddingModel: "text-embedding-3-small",
  timeoutMs: 60000,
  maxRetries: 2,
});

// ── Reviewer rules are READ FROM THE PRODUCTION SOURCE, never copied ─────────────────────────
// Copying the prompt into this file would let the test drift away from what actually ships, so
// the array is parsed straight out of openai-provider.ts. (It cannot be imported instead: the
// container's compiled dist/ is from the last build and predates these rules — reading the .ts
// source is what lets this run without a rebuild.)
const PROVIDER_SRC = "/repo/packages/ai-core/src/providers/openai-provider.ts";

function loadReviewRulesFromSource() {
  const fs = require("node:fs");
  if (!fs.existsSync(PROVIDER_SRC)) {
    throw new Error(
      `Tidak menemukan ${PROVIDER_SRC}. Salin dulu source-nya ke container:\n` +
        "  docker compose cp packages/ai-core/src/providers/openai-provider.ts api:" +
        PROVIDER_SRC,
    );
  }
  const src = fs.readFileSync(PROVIDER_SRC, "utf8");
  const marker = "export const GROUNDING_REVIEW_RULES: readonly string[] = [";
  const start = src.indexOf(marker);
  if (start === -1) {
    throw new Error(
      "openai-provider.ts di container belum punya GROUNDING_REVIEW_RULES — berarti yang tersalin masih versi lama.",
    );
  }
  const bodyStart = start + marker.length;
  const end = src.indexOf("\n];", bodyStart);
  const body = src.slice(bodyStart, end);
  // Our own source file, evaluated as an array literal.
  const rules = new Function(`return [${body}]`)();
  if (!Array.isArray(rules) || rules.length === 0) throw new Error("Gagal membaca GROUNDING_REVIEW_RULES.");
  return rules;
}

const ALL_RULES = loadReviewRulesFromSource();

// The three rules the fix added. Identified by their opening words so we can reconstruct the
// pre-fix reviewer and measure the difference; if any of them is missing the test stops rather
// than quietly comparing two identical prompts and reporting a meaningless "no change".
const ADDED_RULE_PREFIXES = ["ANGKA:", "PENTING — dokumen referensi", "Kalau ragu-ragu"];
const NEW_RULES = ALL_RULES.filter((r) => ADDED_RULE_PREFIXES.some((p) => r.startsWith(p)));
const OLD_RULES = ALL_RULES.filter((r) => !ADDED_RULE_PREFIXES.some((p) => r.startsWith(p)));

if (NEW_RULES.length !== ADDED_RULE_PREFIXES.length) {
  console.error(
    `Hanya menemukan ${NEW_RULES.length} dari ${ADDED_RULE_PREFIXES.length} aturan baru di source.\n` +
      "Source di container kemungkinan versi lama — salin ulang lalu jalankan lagi.",
  );
  process.exit(1);
}

const REVIEW_TAIL = (message, draftAnswer, evidenceBlock) => [
  "",
  "=== PERTANYAAN CUSTOMER ===",
  message,
  "",
  "=== DRAFT JAWABAN ===",
  draftAnswer,
  "",
  "=== DOKUMEN REFERENSI ===",
  evidenceBlock,
];

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    grounded: { type: "boolean" },
    revisedAnswer: { type: "string" },
    confidence: { type: "number" },
    handoffRequired: { type: "boolean" },
  },
  required: ["grounded", "revisedAnswer", "confidence", "handoffRequired"],
  additionalProperties: false,
};

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    confidence: { type: "number" },
    handoffRequired: { type: "boolean" },
  },
  required: ["answer", "confidence", "handoffRequired"],
  additionalProperties: false,
};

async function ask(system, user, schema, name, temperature) {
  const r = await client.responses.create({
    model: MODEL,
    temperature,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text: { format: { type: "json_schema", name, schema, strict: true } },
  });
  return JSON.parse(r.output_text);
}

async function main() {
  const site = await prisma.site.findFirst();
  if (!site) {
    console.error("Tidak ada site di database.");
    process.exit(1);
  }

  const docs = await prisma.knowledgeDocument.groupBy({ by: ["status"], _count: true });
  const chunkCount = await prisma.knowledgeChunk.count({ where: { siteId: site.id } });
  console.log(`\nSite      : ${site.name}`);
  console.log(`KB di DB  : ${chunkCount} potongan | dokumen per status: ${docs.map((d) => `${d.status}=${d._count}`).join(", ")}`);
  console.log(`Semua bukti di bawah diambil LANGSUNG dari database ini, bukan dari file.\n`);

  const totals = { old: 0, new: 0, count: 0, noEvidence: 0 };

  for (const message of questions) {
    console.log("=".repeat(74));
    console.log(`PERTANYAAN: ${message}`);
    console.log("=".repeat(74));

    // Real retrieval, real DB, real embeddings — same class the API itself uses.
    const evidence = await new KnowledgeRetriever(prisma, provider).retrieve({
      siteId: site.id,
      query: message,
      allowedAudiences: ["PUBLIC"],
      includeFullContext: true,
    });

    if (evidence.length === 0) {
      console.log("  Tidak ada bukti terambil dari KB -> AI akan bilang 'informasi belum tersedia'.");
      console.log("  Kalau jawabannya sebenarnya ADA di KB kamu, berarti masalahnya di pencarian, bukan di review.\n");
      totals.noEvidence++;
      continue;
    }

    const evidenceBlock = evidence.map((e, i) => `[${i + 1}] (${e.title}) ${e.content}`).join("\n\n");
    const docTitles = [...new Set(evidence.map((e) => e.title))];
    console.log(`  bukti     : ${evidence.length} potongan dari ${docTitles.length} dokumen -> ${docTitles.join(", ")}`);

    const draft = await ask(
      [
        `Anda adalah ${site.aiName}, asisten virtual resmi PT Solid Gold Berjangka.`,
        "Jawab pertanyaan customer HANYA berdasarkan dokumen referensi di bawah, natural dan langsung ke inti, maksimal 2-5 kalimat.",
        "Kalau dokumen memuat angka/nominal yang menjawab pertanyaan, sebutkan angkanya persis.",
        "Jangan menyebut judul dokumen, nama file, atau nomor referensi.",
        "",
        "=== DOKUMEN REFERENSI ===",
        evidenceBlock,
      ].join("\n"),
      message,
      ANSWER_SCHEMA,
      "customer_answer",
      0.9,
    );
    console.log(`  draft AI  : ${draft.answer}`);

    for (const [key, label, rules] of [
      ["old", "review LAMA", OLD_RULES],
      ["new", "review BARU", ALL_RULES],
    ]) {
      let passed = 0;
      let sampleRevised = "";
      for (let i = 0; i < RUNS; i++) {
        const v = await ask(
          [...rules, ...REVIEW_TAIL(message, draft.answer, evidenceBlock)].join("\n"),
          message,
          REVIEW_SCHEMA,
          "grounding_review",
          0.1,
        );
        if (v.grounded) passed++;
        else if (!sampleRevised) sampleRevised = v.revisedAnswer;
      }
      totals[key] += passed;
      const mark = passed === RUNS ? "LOLOS" : passed === 0 ? "DITOLAK" : "goyah";
      console.log(`  ${label}: ${passed}/${RUNS} ${mark}${passed < RUNS ? ` -> customer malah dapat: "${sampleRevised}"` : ""}`);
    }
    totals.count++;
    console.log();
  }

  const max = totals.count * RUNS;
  console.log("─".repeat(74));
  console.log(`Pertanyaan diuji            : ${totals.count} (${totals.noEvidence} dilewati karena KB tidak punya datanya)`);
  if (max > 0) {
    console.log(`Lolos dengan review LAMA    : ${totals.old}/${max}`);
    console.log(`Lolos dengan review BARU    : ${totals.new}/${max}`);
  }
  console.log("─".repeat(74));

  if (max === 0) {
    console.log("HASIL: tidak ada bukti terambil sama sekali — masalahnya di pencarian KB, bukan di review.");
    console.log("       Jangan rebuild dulu, kirim output ini ke saya.");
  } else if (totals.new === max && totals.new > totals.old) {
    console.log(`HASIL: FIX BERHASIL — dari ${totals.old}/${max} jadi ${max}/${max}. Aman untuk rebuild.`);
  } else if (totals.new === max && totals.old === max) {
    console.log("HASIL: dua versi sama-sama lolos penuh. Fix ini tidak merusak apa pun, tapi penolakan");
    console.log("       kemarin mungkin sebab lain — boleh rebuild, lalu tes lagi lewat widget.");
  } else if (totals.new > totals.old) {
    console.log(`HASIL: MEMBAIK tapi belum penuh (${totals.old} -> ${totals.new} dari ${max}). Kirim output ini ke saya.`);
  } else {
    console.log(`HASIL: BELUM BERHASIL (${totals.old} -> ${totals.new} dari ${max}). Jangan rebuild — kirim output ini.`);
  }
  console.log("─".repeat(74));
}

main()
  .catch((e) => {
    console.error("\nGAGAL:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
