export const QUEUE_NAMES = {
  CRM_SYNC: "crm-sync",
  ANALYTICS_AGGREGATION: "analytics-aggregation",
  CLEANUP: "cleanup",
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface CrmSyncJobData {
  leadId: string;
}
