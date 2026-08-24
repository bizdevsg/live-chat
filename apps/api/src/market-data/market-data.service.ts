import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KnowledgeAudience, type KnowledgeEvidence } from "@solidchat/shared";
import WebSocket, { type RawData } from "ws";

interface MarketQuote {
  symbol: string;
  displayName?: string;
  bid?: number;
  ask?: number;
  last?: number;
  open?: number;
  high?: number;
  low?: number;
  spread?: number;
  updatedAt: string;
  receivedAt: string;
}

type JsonRecord = Record<string, unknown>;

const MAX_SYNTHETIC_EVIDENCE = 3;
const DEFAULT_RECONNECT_DELAY_MS = 5_000;
const DEFAULT_MAX_QUOTE_AGE_MS = 30_000;
const PRICE_LOOKUP_PATTERN = /\b(?:harga|price|quote|bid|ask|spread|rate|kurs|berapa|cek|info|lihat|live|current|latest|terbaru|sekarang|saat ini)\b|\?/i;

const MARKET_SYMBOL_ALIASES: Array<{ pattern: RegExp; preferredSymbols: string[] }> = [
  { pattern: /\b(?:xauusd|xau|gold|emas|loco london)\b/i, preferredSymbols: ["XAUUSD", "XUL10", "XULF", "XUL"] },
  { pattern: /\b(?:xagusd|xag|silver|perak)\b/i, preferredSymbols: ["XAGUSD", "XAG10_BBJ", "XAGF_BBJ", "XAG"] },
  { pattern: /\b(?:brent|oil|crude|bco)\b/i, preferredSymbols: ["BCO10_BBJ", "BCOF_BBJ", "BCO"] },
  { pattern: /\b(?:eurusd|eur usd|euro usd|eu1010|eu10f)\b/i, preferredSymbols: ["EURUSD", "EU1010_BBJ", "EU10F_BBJ"] },
  { pattern: /\b(?:gbpusd|gbp usd|pound usd|gu1010|gu10f)\b/i, preferredSymbols: ["GBPUSD", "GU1010_BBJ", "GU10F_BBJ"] },
  { pattern: /\b(?:usdjpy|usd jpy|uj1010|uj10f)\b/i, preferredSymbols: ["USDJPY", "UJ1010_BBJ", "UJ10F_BBJ"] },
];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSymbol(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickString(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function pickNumber(record: JsonRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const parsed = parseNumber(record[key]);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function normalizeTimestamp(record: JsonRecord): string {
  const raw = pickString(record, ["updatedAt", "updateTime", "timestamp", "time", "datetime", "date"]);
  if (!raw) return new Date().toISOString();

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && raw.trim().length >= 10) {
    const millis = raw.trim().length <= 10 ? asNumber * 1000 : asNumber;
    return new Date(millis).toISOString();
  }

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

function looksLikeSymbolKey(value: string) {
  return /^[A-Z0-9_]{3,24}$/.test(value);
}

function looksLikeQuoteRecord(record: JsonRecord) {
  const symbol = pickString(record, ["symbol", "sym", "instrument", "product", "code", "ticker"]);
  const hasPrice =
    pickNumber(record, ["bid", "Bid", "buy", "Buy"]) !== undefined ||
    pickNumber(record, ["ask", "Ask", "offer", "Offer", "sell", "Sell"]) !== undefined ||
    pickNumber(record, ["last", "Last", "price", "Price", "close", "Close"]) !== undefined;
  return !!symbol && hasPrice;
}

function normalizeQuoteCandidate(candidate: JsonRecord): MarketQuote | null {
  const symbol = normalizeSymbol(pickString(candidate, ["symbol", "sym", "instrument", "product", "code", "ticker"]));
  if (!symbol) return null;

  const bid = pickNumber(candidate, ["bid", "Bid", "buy", "Buy"]);
  const ask = pickNumber(candidate, ["ask", "Ask", "offer", "Offer", "sell", "Sell"]);
  const last = pickNumber(candidate, ["last", "Last", "price", "Price", "close", "Close"]);
  const open = pickNumber(candidate, ["open", "Open"]);
  const high = pickNumber(candidate, ["high", "High"]);
  const low = pickNumber(candidate, ["low", "Low"]);
  if (bid === undefined && ask === undefined && last === undefined) return null;

  return {
    symbol,
    displayName: pickString(candidate, ["name", "displayName", "description", "productName"]),
    bid,
    ask,
    last,
    open,
    high,
    low,
    spread: ask !== undefined && bid !== undefined ? ask - bid : undefined,
    updatedAt: normalizeTimestamp(candidate),
    receivedAt: new Date().toISOString(),
  };
}

function collectQuoteCandidates(payload: unknown): JsonRecord[] {
  const candidates: JsonRecord[] = [];

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    if (!isRecord(value)) return;
    if (looksLikeQuoteRecord(value)) candidates.push(value);

    for (const [key, nested] of Object.entries(value)) {
      if (Array.isArray(nested)) {
        visit(nested);
        continue;
      }

      if (!isRecord(nested)) continue;
      if (looksLikeSymbolKey(key) && !("symbol" in nested)) {
        candidates.push({ symbol: key, ...nested });
      }
      visit(nested);
    }
  };

  visit(payload);
  return candidates;
}

function formatQuoteNumber(value: number | undefined) {
  return value === undefined ? "-" : value.toString();
}

@Injectable()
export class MarketDataService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly endpoint: string;
  private readonly enabled: boolean;
  private readonly reconnectDelayMs: number;
  private readonly maxQuoteAgeMs: number;
  private readonly subscribeMessage: string | null;
  private readonly quotes = new Map<string, MarketQuote>();
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private loggedFirstQuote = false;
  private loggedNonJsonPayload = false;
  private shuttingDown = false;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.parseBoolean(this.config.get("MARKET_DATA_WS_ENABLED"), true);
    this.endpoint = (this.config.get<string>("MARKET_DATA_WS_URL") ?? "wss://wsprc.royalassetindo.co.id").trim();
    this.reconnectDelayMs = Number(this.config.get<string>("MARKET_DATA_WS_RECONNECT_MS") ?? DEFAULT_RECONNECT_DELAY_MS);
    this.maxQuoteAgeMs = Number(this.config.get<string>("MARKET_DATA_MAX_QUOTE_AGE_MS") ?? DEFAULT_MAX_QUOTE_AGE_MS);
    this.subscribeMessage = this.config.get<string>("MARKET_DATA_WS_SUBSCRIBE_MESSAGE")?.trim() || null;
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log("Realtime market data feed disabled by config.");
      return;
    }
    this.connect();
  }

  onModuleDestroy() {
    this.shuttingDown = true;
    this.clearReconnectTimer();
    this.socket?.removeAllListeners();
    this.socket?.close();
    this.socket = null;
  }

  getRealtimePriceEvidence(message: string): KnowledgeEvidence[] {
    const requestedSymbols = this.resolveRequestedSymbols(message);
    if (requestedSymbols.length === 0 || !PRICE_LOOKUP_PATTERN.test(message)) return [];

    return requestedSymbols
      .map((symbol) => this.quotes.get(symbol))
      .filter((quote): quote is MarketQuote => !!quote && this.isFreshQuote(quote))
      .slice(0, MAX_SYNTHETIC_EVIDENCE)
      .map((quote) => ({
        chunkId: `market-quote:${quote.symbol}`,
        documentId: `market-feed:${quote.symbol}`,
        title: `Realtime Market Price - ${quote.symbol}`,
        version: 1,
        audience: KnowledgeAudience.PUBLIC,
        content: [
          "Realtime market price snapshot.",
          `Symbol: ${quote.symbol}`,
          quote.displayName ? `Display name: ${quote.displayName}` : null,
          `Bid: ${formatQuoteNumber(quote.bid)}`,
          `Ask: ${formatQuoteNumber(quote.ask)}`,
          quote.last !== undefined ? `Last: ${formatQuoteNumber(quote.last)}` : null,
          quote.open !== undefined ? `Open: ${formatQuoteNumber(quote.open)}` : null,
          quote.high !== undefined ? `High: ${formatQuoteNumber(quote.high)}` : null,
          quote.low !== undefined ? `Low: ${formatQuoteNumber(quote.low)}` : null,
          quote.spread !== undefined ? `Spread: ${formatQuoteNumber(quote.spread)}` : null,
          `Updated at: ${quote.updatedAt}`,
          "Gunakan snapshot ini hanya untuk menjawab pertanyaan harga/live quote saat ini.",
        ]
          .filter((line): line is string => !!line)
          .join("\n"),
      }));
  }

  private connect() {
    this.clearReconnectTimer();
    this.socket?.removeAllListeners();
    this.socket?.close();

    this.logger.log(`Connecting to realtime market data feed: ${this.endpoint}`);
    this.socket = new WebSocket(this.endpoint);
    this.socket.on("open", () => {
      this.logger.log("Realtime market data feed connected.");
      if (this.subscribeMessage) {
        this.socket?.send(this.subscribeMessage);
      }
    });
    this.socket.on("message", (data) => this.handleMessage(data));
    this.socket.on("error", (error) => {
      this.logger.warn(`Realtime market data feed error: ${(error as Error).message}`);
    });
    this.socket.on("close", (code, reason) => {
      const detail = reason.toString() || "no reason";
      this.logger.warn(`Realtime market data feed closed (${code}): ${detail}`);
      if (this.shuttingDown) return;
      this.scheduleReconnect();
    });
  }

  private handleMessage(data: RawData) {
    const rawText =
      typeof data === "string"
        ? data
        : Array.isArray(data)
          ? Buffer.concat(data.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))).toString("utf8")
          : Buffer.isBuffer(data)
            ? data.toString("utf8")
            : Buffer.from(data).toString("utf8");
    let payload: unknown;

    try {
      payload = JSON.parse(rawText);
    } catch {
      if (!this.loggedNonJsonPayload) {
        this.loggedNonJsonPayload = true;
        this.logger.warn(`Realtime market data feed returned non-JSON payload. Sample: ${rawText.slice(0, 300)}`);
      }
      return;
    }

    const candidates = collectQuoteCandidates(payload);
    for (const candidate of candidates) {
      const quote = normalizeQuoteCandidate(candidate);
      if (!quote) continue;
      this.quotes.set(quote.symbol, quote);
      if (!this.loggedFirstQuote) {
        this.loggedFirstQuote = true;
        this.logger.log(`First realtime quote received for ${quote.symbol}.`);
      }
    }
  }

  private resolveRequestedSymbols(message: string) {
    const resolved = new Set<string>();

    for (const symbol of this.quotes.keys()) {
      const pattern = new RegExp(`\\b${escapeRegex(symbol).replace(/_/g, "[_ ]?")}\\b`, "i");
      if (pattern.test(message)) {
        resolved.add(symbol);
      }
    }

    for (const alias of MARKET_SYMBOL_ALIASES) {
      if (!alias.pattern.test(message)) continue;
      for (const preferredSymbol of alias.preferredSymbols) {
        const matched = this.findAvailableSymbol(preferredSymbol);
        if (matched) {
          resolved.add(matched);
          break;
        }
      }
    }

    return [...resolved];
  }

  private findAvailableSymbol(target: string) {
    const normalizedTarget = normalizeSymbol(target);
    for (const symbol of this.quotes.keys()) {
      if (symbol === normalizedTarget || symbol.includes(normalizedTarget) || normalizedTarget.includes(symbol)) {
        return symbol;
      }
    }
    return null;
  }

  private isFreshQuote(quote: MarketQuote) {
    const updatedAtMs = Date.parse(quote.updatedAt);
    return !Number.isNaN(updatedAtMs) && Date.now() - updatedAtMs <= this.maxQuoteAgeMs;
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelayMs);
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private parseBoolean(value: unknown, fallback: boolean) {
    if (value === undefined) return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value !== "string") return fallback;
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
}
