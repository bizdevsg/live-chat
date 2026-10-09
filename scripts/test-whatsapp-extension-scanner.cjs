const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function classList(...names) {
  const values = new Set(names);
  return { contains: (name) => values.has(name) };
}

function selectableText(content) {
  return {
    textContent: content,
    querySelector: () => null,
  };
}

function makeMessage({ id, content, senderLabel, tail, left, index }) {
  const selectable = selectableText(content);
  const wrapper = {
    querySelectorAll: () => [selectable],
  };
  const labelNode = {
    getAttribute: (name) => (name === "aria-label" ? senderLabel : null),
  };
  const bubble = {
    classList: classList(),
    matches: (selector) => selector.includes("[data-testid='msg-container']"),
    querySelectorAll: (selector) => {
      if (selector === "[data-pre-plain-text]") return [wrapper];
      if (selector === "[aria-label]") return senderLabel ? [labelNode] : [];
      return [];
    },
    querySelector: (selector) => {
      if (selector.includes("[aria-label='You:']")) return senderLabel === "You:" ? labelNode : null;
      if (selector.includes("tail-out")) return tail === "out" ? {} : null;
      if (selector.includes("tail-in")) return tail === "in" ? {} : null;
      if (selector === "[data-pre-plain-text]") return wrapper;
      if (selector === "[data-id]") return null;
      return null;
    },
    getAttribute: () => null,
    getBoundingClientRect: () => ({ left, width: 260 }),
  };
  const row = {
    classList: classList(),
    matches: (selector) => selector.includes("[data-testid^='conv-msg-']"),
    closest: () => row,
    querySelector: (selector) =>
      selector.includes("[data-testid='msg-container']") ? bubble : null,
    getAttribute: (name) => (name === "data-id" ? id : null),
    compareDocumentPosition: (other) => (index < other.__index ? 4 : 2),
    __index: index,
  };
  return row;
}

const rows = [
  makeMessage({
    id: "incoming-with-tail",
    content: "klik pesan baru munculnya seperti ini",
    senderLabel: "Kak Nita:",
    tail: "in",
    left: 20,
    index: 0,
  }),
  makeMessage({
    id: "outgoing",
    content: "Baik kak, saya cek.",
    senderLabel: "You:",
    tail: "out",
    left: 700,
    index: 1,
  }),
  makeMessage({
    id: "incoming-without-tail",
    content: "untuk akun reguler punya produk apa saja dan akun mini produknya apa saja?",
    senderLabel: "Kak Nita:",
    tail: null,
    left: 20,
    index: 2,
  }),
];

const main = {
  querySelectorAll: () => rows,
  querySelector: (selector) =>
    selector.startsWith("header")
      ? { getAttribute: () => "Kak Nita NM23", textContent: "Kak Nita NM23" }
      : null,
  getBoundingClientRect: () => ({ left: 0, width: 1000 }),
};

let runtimeListener;
const context = {
  console,
  setTimeout,
  clearTimeout,
  globalThis: {},
  document: {
    body: {},
    querySelector: (selector) => (selector === "#main" ? main : null),
  },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  chrome: {
    runtime: {
      onMessage: {
        addListener(listener) {
          runtimeListener = listener;
        },
      },
      sendMessage: async () => ({ ok: true }),
    },
    storage: {
      local: {
        get: async () => ({}),
      },
    },
  },
};
context.globalThis = context;

const contentPath = path.resolve(__dirname, "..", "extensions", "whatsapp-assistant", "content.js");
vm.runInNewContext(fs.readFileSync(contentPath, "utf8"), context, { filename: contentPath });

let response;
runtimeListener({ type: "GET_CONTEXT" }, null, (value) => {
  response = value;
});

assert.equal(response.ok, true);
assert.equal(response.data.messages.length, 3);
assert.equal(
  response.data.messages.map((message) => message.senderType).join(","),
  "CUSTOMER,AGENT,CUSTOMER",
);
assert.equal(response.data.latestCustomerMessage.id, "incoming-without-tail");
assert.match(response.data.latestCustomerMessage.content, /akun reguler/i);

console.log("WhatsApp scanner regression test passed.");
