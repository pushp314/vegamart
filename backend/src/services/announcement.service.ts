import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import { notificationService } from "./notification.service";
import * as announcementRepo from "../repositories/announcement.repository";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

export const ANNOUNCEMENT_AUDIENCES = ["all", "customer", "vendor", "delivery"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  audience?: AnnouncementAudience;
  is_active?: boolean;
  scheduled_at?: Date | null;
  publish?: boolean;
}

export const announcementService = {
  async list(query: {
    page?: number;
    per_page?: number;
    q?: string;
    audience?: string;
    is_active?: string;
    published?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const { rows, total } = await announcementRepo.listAnnouncements(
      {
        q: query.q,
        audience: query.audience,
        isActive: query.is_active === "true" ? true : query.is_active === "false" ? false : undefined,
        published: query.published === "true" ? true : query.published === "false" ? false : undefined,
      },
      (page - 1) * perPage,
      perPage
    );
    return { rows, total, page, perPage };
  },

  async getById(id: string) {
    const row = await announcementRepo.findById(id);
    if (!row) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Announcement not found.", { code: "NOT_FOUND" });
    }
    return row;
  },

  async create(input: CreateAnnouncementInput, adminUserId: string, req: Request) {
    const row = await announcementRepo.createAnnouncement({
      title: input.title,
      body: input.body,
      audience: input.audience ?? "all",
      is_active: input.is_active ?? true,
      scheduled_at: input.scheduled_at ?? null,
      created_by: adminUserId,
    });

    if (input.publish) {
      const published = await announcementRepo.updateAnnouncement(row.id, {
        published_at: new Date(),
        is_active: true,
      });
      await auditService.record(
        { userId: adminUserId, action: AUDIT_ACTIONS.ANNOUNCEMENT_PUBLISHED, entityType: "announcement", entityId: row.id },
        req
      );
      return published;
    }

    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.ANNOUNCEMENT_CREATED, entityType: "announcement", entityId: row.id, newValues: { title: row.title } },
      req
    );
    return row;
  },

  async update(
    id: string,
    input: {
      title?: string;
      body?: string;
      audience?: AnnouncementAudience;
      is_active?: boolean;
      scheduled_at?: Date | null;
    },
    adminUserId: string,
    req: Request
  ) {
    const existing = await this.getById(id);
    if (existing.published_at && input.is_active === false) {
      const updated = await announcementRepo.updateAnnouncement(id, { is_active: false });
      await auditService.record(
        { userId: adminUserId, action: AUDIT_ACTIONS.ANNOUNCEMENT_UNPUBLISHED, entityType: "announcement", entityId: id },
        req
      );
      return updated;
    }

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.body !== undefined) data.body = input.body;
    if (input.audience !== undefined) data.audience = input.audience;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (input.scheduled_at !== undefined) data.scheduled_at = input.scheduled_at;

    if (Object.keys(data).length > 0) {
      await announcementRepo.updateAnnouncement(id, data as never);
    }

    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.ANNOUNCEMENT_UPDATED, entityType: "announcement", entityId: id, newValues: data },
      req
    );
    return this.getById(id);
  },

  async publish(id: string, adminUserId: string, req: Request) {
    const existing = await this.getById(id);
    const updated = await announcementRepo.updateAnnouncement(id, {
      published_at: new Date(),
      is_active: true,
    });

    if (!existing.published_at) {
      await notificationService.send({
        user_id: adminUserId,
        type: "SYSTEM",
        title: "Announcement published",
        body: existing.title,
        data: { announcement_id: id },
      });
    }

    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.ANNOUNCEMENT_PUBLISHED, entityType: "announcement", entityId: id },
      req
    );
    return updated;
  },

  async unpublish(id: string, adminUserId: string, req: Request) {
    await this.getById(id);
    const updated = await announcementRepo.updateAnnouncement(id, { is_active: false, published_at: null });
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.ANNOUNCEMENT_UNPUBLISHED, entityType: "announcement", entityId: id },
      req
    );
    return updated;
  },

  async remove(id: string, adminUserId: string, req: Request) {
    await this.getById(id);
    await announcementRepo.softDelete(id);
    await auditService.record(
      { userId: adminUserId, action: AUDIT_ACTIONS.ANNOUNCEMENT_DELETED, entityType: "announcement", entityId: id },
      req
    );
    return { success: true };
  },
};
