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

  private async request<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10_000);
    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
          ...init.headers,
        },
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
    } catch {
      return null;
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
