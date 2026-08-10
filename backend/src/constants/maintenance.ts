export type MaintenanceSeverity = "critical" | "high" | "medium" | "low";

export interface MaintenanceTaskDefinition {
  type: string;
  label: string;
  severity: MaintenanceSeverity;
  cadence_days: number;
  description: string;
  dev_note: string;
}

export const MAINTENANCE_TASKS: ReadonlyArray<MaintenanceTaskDefinition> = [
  {
    type: "backup",
    label: "Database Backup & Health Check",
    severity: "high",
    cadence_days: 7,
    description: "Verify automatic database backups are running and a restore has been tested.",
    dev_note: "Database backup & integrity check",
  },
  {
    type: "security",
    label: "Security & Vulnerability Scan",
    severity: "critical",
    cadence_days: 15,
    description: "Review security patches, scan for vulnerabilities and check access logs.",
    dev_note: "Security review, patches & vulnerability scan",
  },
  {
    type: "dependencies",
    label: "App & Dependency Updates",
    severity: "medium",
    cadence_days: 30,
    description: "Update the framework, libraries and database schema if needed.",
    dev_note: "Upgrade app dependencies & frameworks",
  },
  {
    type: "performance",
    label: "Performance & Speed Optimization",
    severity: "medium",
    cadence_days: 60,
    description: "Review load times, cache behaviour and optimize slow queries.",
    dev_note: "Performance & speed optimization",
  },
  {
    type: "storage",
    label: "Storage & Media Cleanup",
    severity: "low",
    cadence_days: 90,
    description: "Clean up unused media, temporary uploads and reduce storage cost.",
    dev_note: "Storage & media cleanup",
  },
];

export const MAINTENANCE_SCHEDULE_KEY = "maintenance.schedule";

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function overdueDays(dueAt: Date, now = new Date()): number {
  const diff = now.getTime() - dueAt.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / DAY_MS);
}