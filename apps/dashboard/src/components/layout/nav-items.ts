import { Permission } from "@/lib/permissions";

export type NavIcon =
  | "home"
  | "inbox"
  | "chart"
  | "ticket"
  | "users"
  | "lead"
  | "book"
  | "spark"
  | "bot"
  | "message"
  | "widget"
  | "route"
  | "team"
  | "shield"
  | "file";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  permission?: Permission;
}

export interface NavSection {
  id: "beranda" | "menu" | "system";
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "beranda",
    label: "Beranda",
    items: [
      { href: "/dashboard", label: "Beranda", icon: "home", permission: Permission.ANALYTICS_VIEW },
      { href: "/inbox", label: "Inbox", icon: "inbox", permission: Permission.CONVERSATION_HANDLE },
      { href: "/analytics", label: "Analytics", icon: "chart", permission: Permission.ANALYTICS_VIEW },
    ],
  },
  {
    id: "menu",
    label: "Menu",
    items: [
      { href: "/tickets", label: "Tickets", icon: "ticket", permission: Permission.TICKET_MANAGE },
      { href: "/customers", label: "Customers", icon: "users", permission: Permission.CUSTOMER_VIEW },
      { href: "/leads", label: "Leads", icon: "lead", permission: Permission.LEAD_VIEW },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/knowledge", label: "Knowledge Base", icon: "book", permission: Permission.KNOWLEDGE_EDIT },
      { href: "/ai/configuration", label: "AI Configuration", icon: "bot", permission: Permission.AI_CONFIG_MANAGE },
      { href: "/ai/runs", label: "AI Runs", icon: "spark", permission: Permission.AI_CONFIG_MANAGE },
      { href: "/templates", label: "Response Templates", icon: "message", permission: Permission.TEMPLATE_MANAGE },
      { href: "/widget", label: "Widget Settings", icon: "widget", permission: Permission.WIDGET_MANAGE },
      { href: "/routing", label: "Routing Rules", icon: "route", permission: Permission.ROUTING_MANAGE },
      { href: "/teams", label: "CS & Teams", icon: "team", permission: Permission.TEAM_MANAGE },
      { href: "/users", label: "Users", icon: "users", permission: Permission.USER_MANAGE },
      { href: "/security", label: "Security", icon: "shield", permission: Permission.SECURITY_MANAGE },
      { href: "/audit-logs", label: "Audit Logs", icon: "file", permission: Permission.AUDIT_LOG_VIEW },
    ],
  },
];
