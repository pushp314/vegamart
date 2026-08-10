import { maintenanceService } from "../../src/services/maintenance.service";
import { MAINTENANCE_SCHEDULE_KEY, MAINTENANCE_TASKS, addDays } from "../../src/constants/maintenance";

jest.mock("../../src/repositories/settings.repository", () => ({
  getByKey: jest.fn(),
  upsertSetting: jest.fn(),
  getByKeys: jest.fn(),
  getPublicSettings: jest.fn(),
  listAllSettings: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

import * as settingsRepo from "../../src/repositories/settings.repository";

const repo = settingsRepo as jest.Mocked<typeof settingsRepo>;

const NOW = new Date("2026-08-10T10:00:00.000Z");

function seededState(seed: Partial<Record<string, string | null>> = {}) {
  return JSON.stringify({
    baseline: "2026-08-10T10:00:00.000Z",
    tasks: Object.fromEntries(Object.entries(seed).map(([type, doneAt]) => [type, { done_at: doneAt }])),
    contact_email: seed.contact_email ?? null,
    contact_phone: seed.contact_phone ?? null,
  });
}

describe("maintenanceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("bootstraps an empty schedule to today so no task is due immediately", async () => {
    repo.getByKey.mockResolvedValue(null);

    const status = await maintenanceService.getStatus();

    expect(repo.getByKey).toHaveBeenCalledWith(MAINTENANCE_SCHEDULE_KEY);
    expect(status.baseline).toBe(NOW.toISOString());
    expect(status.tasks).toHaveLength(MAINTENANCE_TASKS.length);
    expect(status.tasks.every((t) => t.status === "upcoming")).toBe(true);
    expect(status.tasks.every((t) => t.overdue_days === 0)).toBe(true);
  });

  it("flags a task as due once its cadence window has elapsed", async () => {
    const backupDone = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    repo.getByKey.mockResolvedValue({
      key: MAINTENANCE_SCHEDULE_KEY,
      value: seededState({ backup: backupDone }),
      type: "string",
    } as never);

    const status = await maintenanceService.getStatus();

    const backup = status.tasks.find((t) => t.type === "backup")!;
    expect(backup.status).toBe("due");
    expect(backup.overdue_days).toBe(3);
    const security = status.tasks.find((t) => t.type === "security")!;
    expect(security.status).toBe("upcoming");
  });

  it("shows the earliest upcoming due date as next_due_at", async () => {
    repo.getByKey.mockResolvedValue({
      key: MAINTENANCE_SCHEDULE_KEY,
      value: seededState({}),
      type: "string",
    } as never);

    const status = await maintenanceService.getStatus();

    const backup = status.tasks.find((t) => t.type === "backup")!;
    expect(status.next_due_at).toBe(backup.due_at);
  });

  it("marks a task done and reschedules its next alert by the cadence", async () => {
    repo.getByKey.mockResolvedValue({
      key: MAINTENANCE_SCHEDULE_KEY,
      value: seededState({}),
      type: "string",
    } as never);

    const status = await maintenanceService.markDone("backup", "admin-1");

    const saved = repo.upsertSetting.mock.calls[0]![0];
    const savedState = JSON.parse(saved.value as string) as { tasks: Record<string, { done_at: string }> };
    expect(savedState.tasks.backup!.done_at).toBe(NOW.toISOString());
    expect(status.tasks.find((t) => t.type === "backup")!.due_at).toBe(
      addDays(NOW, MAINTENANCE_TASKS.find((t) => t.type === "backup")!.cadence_days).toISOString()
    );
  });

  it("rejects unknown task types", async () => {
    repo.getByKey.mockResolvedValue(null);

    await expect(maintenanceService.markDone("unknown", "admin-1")).rejects.toThrow(
      "Unknown maintenance task type"
    );
  });

  it("updates the developer contact used in alerts", async () => {
    repo.getByKey.mockResolvedValue({
      key: MAINTENANCE_SCHEDULE_KEY,
      value: seededState({}),
      type: "string",
    } as never);

    const status = await maintenanceService.updateContact(
      { contact_email: "dev@example.com", contact_phone: "+91 99999 99999" },
      "admin-1"
    );

    expect(status.contact).toEqual({
      contact_email: "dev@example.com",
      contact_phone: "+91 99999 99999",
    });
  });
});