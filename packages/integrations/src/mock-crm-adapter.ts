import { randomUUID } from "node:crypto";
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

/** Deterministic no-network adapter for development and automated tests. */
export class MockCrmAdapter implements CrmAdapter {
  readonly name = "mock";

  async findCustomer(input: FindCustomerInput): Promise<CrmCustomerResult | null> {
    if (!input.email && !input.phone && !input.externalId) return null;
    return {
      crmCustomerId: `mock-cust-${input.email ?? input.phone ?? input.externalId}`,
      name: "Mock Customer",
      email: input.email,
      phone: input.phone,
      accountStatus: "active",
    };
  }

  async createLead(_input: CreateLeadInput): Promise<CreateLeadResult> {
    return { crmLeadId: `mock-lead-${randomUUID()}` };
  }

  async createTicket(_input: CreateCrmTicketInput): Promise<CreateTicketResult> {
    return { crmTicketId: `mock-ticket-${randomUUID()}` };
  }

  async updateLead(_input: UpdateLeadInput): Promise<void> {
    // no-op
  }
}
