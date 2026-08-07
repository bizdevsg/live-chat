import { Permission } from "@solidchat/shared";

export interface NavItem {
  href: string;
  label: string;
  permission?: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", permission: Permission.ANALYTICS_VIEW },
  { href: "/inbox", label: "Inbox", permission: Permission.CONVERSATION_HANDLE },
  { href: "/tickets", label: "Tickets", permission: Permission.TICKET_MANAGE },
  { href: "/customers", label: "Customers", permission: Permission.CUSTOMER_VIEW },
  { href: "/leads", label: "Leads", permission: Permission.LEAD_VIEW },
  { href: "/knowledge", label: "Knowledge Base", permission: Permission.KNOWLEDGE_EDIT },
  { href: "/ai/configuration", label: "AI Configuration", permission: Permission.AI_CONFIG_MANAGE },
  { href: "/ai/runs", label: "AI Runs", permission: Permission.AI_CONFIG_MANAGE },
  { href: "/routing", label: "Routing Rules", permission: Permission.ROUTING_MANAGE },
  { href: "/teams", label: "CS & Teams", permission: Permission.TEAM_MANAGE },
  { href: "/users", label: "Users", permission: Permission.USER_MANAGE },
  { href: "/templates", label: "Response Templates", permission: Permission.TEMPLATE_MANAGE },
  { href: "/widget", label: "Widget Settings", permission: Permission.WIDGET_MANAGE },
  { href: "/analytics", label: "Analytics", permission: Permission.ANALYTICS_VIEW },
  { href: "/integrations", label: "Integrations", permission: Permission.INTEGRATION_MANAGE },
  { href: "/security", label: "Security", permission: Permission.SECURITY_MANAGE },
  { href: "/audit-logs", label: "Audit Logs", permission: Permission.AUDIT_LOG_VIEW },
  { href: "/settings", label: "System Settings", permission: Permission.SITE_MANAGE },
];
