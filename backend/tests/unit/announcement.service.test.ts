import { announcementService } from "../../src/services/announcement.service";

jest.mock("../../src/repositories/announcement.repository", () => ({
  findById: jest.fn(),
  listAnnouncements: jest.fn(),
  createAnnouncement: jest.fn(),
  updateAnnouncement: jest.fn(),
  softDelete: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/services/notification.service", () => ({
  notificationService: { send: jest.fn().mockResolvedValue(undefined) },
}));

import * as announcementRepo from "../../src/repositories/announcement.repository";

const repo = announcementRepo as jest.Mocked<typeof announcementRepo>;

const mockReq = { user: { id: "admin-1" } } as any;

function makeAnnouncement(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    title: "Festival Sale",
    body: "Flat 20% off across the platform.",
    audience: "all",
    is_active: true,
    scheduled_at: null,
    published_at: null,
    created_by: "admin-1",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("announcement service", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("creates and publishes an announcement when publish is true", async () => {
    repo.createAnnouncement.mockResolvedValue(makeAnnouncement() as any);
    repo.updateAnnouncement.mockResolvedValue(
      makeAnnouncement({ published_at: new Date() }) as any
    );

    const result = await announcementService.create(
      { title: "Festival Sale", body: "Flat 20% off", publish: true },
      "admin-1",
      mockReq
    );

    expect(repo.updateAnnouncement).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({ published_at: expect.any(Date), is_active: true })
    );
    expect(result.published_at).toBeTruthy();
  });

  it("throws when an announcement is not found", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(announcementService.getById("a1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("unpublishes an active announcement via update with is_active=false", async () => {
    repo.findById.mockResolvedValue(
      makeAnnouncement({ published_at: new Date() }) as any
    );
    repo.updateAnnouncement.mockResolvedValue(
      makeAnnouncement({ is_active: false }) as any
    );

    const result = await announcementService.update(
      "a1",
      { is_active: false },
      "admin-1",
      mockReq
    );

    expect(repo.updateAnnouncement).toHaveBeenCalledWith("a1", { is_active: false });
    expect(result.is_active).toBe(false);
  });

  it("publishes and sends a notification on first publish", async () => {
    repo.findById.mockResolvedValue(makeAnnouncement() as any);
    repo.updateAnnouncement.mockResolvedValue(
      makeAnnouncement({ published_at: new Date() }) as any
    );

    const { notificationService } = await import("../../src/services/notification.service");

    await announcementService.publish("a1", "admin-1", mockReq);

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Announcement published", data: { announcement_id: "a1" } })
    );
  });

  it("soft deletes an announcement", async () => {
    repo.findById.mockResolvedValue(makeAnnouncement() as any);
    repo.softDelete.mockResolvedValue(makeAnnouncement() as any);

    const result = await announcementService.remove("a1", "admin-1", mockReq);
    expect(result).toEqual({ success: true });
    expect(repo.softDelete).toHaveBeenCalledWith("a1");
  });
});
