import type {
  CrmAdapter,
  CreateCrmTicketInput,
  CreateLeadInput,
  CreateLeadResult,
  CreateTicketResult,
  CrmCustomerResult,
  FindCustomerInput,
  UpdateLeadInput,
} from "@solidchat/shared";

export interface RestCrmAdapterConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

/** Server-to-server REST CRM integration — never called from the browser (§28). */
export class RestCrmAdapter implements CrmAdapter {
  readonly name = "rest";

  constructor(private readonly config: RestCrmAdapterConfig) {}

  private buildAuthHeaders() {
    return this.config.apiKey.startsWith("x-api-key_")
      ? { "x-api-key": this.config.apiKey }
      : { Authorization: `Bearer ${this.config.apiKey}` };
  }

  private async request<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10_000);
    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    for (const [key, value] of Object.entries(this.buildAuthHeaders())) {
      if (value) headers.set(key, value);
    }

    if (init.idempotencyKey) {
      headers.set("Idempotency-Key", init.idempotencyKey);
    }

    if (init.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers,
      });
      if (!response.ok) {
        throw new Error(`CRM request failed: ${response.status} ${await response.text()}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async findCustomer(input: FindCustomerInput): Promise<CrmCustomerResult | null> {
    const params = new URLSearchParams();
    if (input.email) params.set("email", input.email);
    if (input.phone) params.set("phone", input.phone);
    if (input.externalId) params.set("externalId", input.externalId);
    try {
      return await this.request<CrmCustomerResult>(`/customers/search?${params.toString()}`, { method: "GET" });
    } catch (error) {
      if ((error as Error).message.includes("404")) return null;
      throw error;
    }
  }

  async createLead(input: CreateLeadInput): Promise<CreateLeadResult> {
    return this.request<CreateLeadResult>("/leads", {
      method: "POST",
      body: JSON.stringify(input),
      idempotencyKey: `lead-${input.email ?? input.phone}-${input.siteId}`,
    });
  }

  async createTicket(input: CreateCrmTicketInput): Promise<CreateTicketResult> {
    return this.request<CreateTicketResult>("/tickets", {
      method: "POST",
      body: JSON.stringify(input),
      idempotencyKey: `ticket-${input.ticketNumber}`,
    });
  }

  async updateLead(input: UpdateLeadInput): Promise<void> {
    await this.request<void>(`/leads/${input.crmLeadId}`, { method: "PATCH", body: JSON.stringify(input) });
  }
}
