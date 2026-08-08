import type { Request } from "express";

import { auditService } from "./audit.service";
import * as videoAdRepo from "../repositories/video-ad.repository";
import { deleteObject, extractKeyFromUrl } from "../storage/r2.client";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

export interface CreateVideoAdInput {
  title: string;
  subtitle?: string;
  video_url: string;
  thumbnail_url?: string;
  cta_text?: string;
  cta_link?: string;
  display_mode?: "watch_cta" | "behind_hero";
  duration?: number;
  is_active?: boolean;
  sort_order?: number;
}

export const videoAdService = {
  async list(query: {
    page?: number;
    per_page?: number;
    q?: string;
    is_active?: string;
    display_mode?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 10));
    const { rows, total } = await videoAdRepo.listVideoAds(
      {
        q: query.q,
        isActive: query.is_active === "true" ? true : query.is_active === "false" ? false : undefined,
        displayMode: query.display_mode,
      },
      (page - 1) * perPage,
      perPage
    );
    return { rows, total, page, perPage };
  },

  async getById(id: string) {
    const row = await videoAdRepo.findById(id);
    if (!row) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Video ad not found.", { code: "NOT_FOUND" });
    }
    return row;
  },

  async listPublic() {
    return videoAdRepo.getActivePublicVideoAds();
  },

  async create(input: CreateVideoAdInput, adminUserId: string, req: Request) {
    const row = await videoAdRepo.createVideoAd({
      title: input.title,
      subtitle: input.subtitle,
      video_url: input.video_url,
      thumbnail_url: input.thumbnail_url,
      cta_text: input.cta_text,
      cta_link: input.cta_link,
      display_mode: input.display_mode ?? "watch_cta",
      duration: input.duration ?? 30,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 0,
      created_by: adminUserId,
    });

    await auditService.record(
      {
        userId: adminUserId,
        action: "VIDEO_AD_CREATED",
        entityType: "video_ad",
        entityId: row.id,
        newValues: { title: row.title, display_mode: row.display_mode },
      },
      req
    );
    return row;
  },

  async update(
    id: string,
    input: {
      title?: string;
      subtitle?: string;
      video_url?: string;
      thumbnail_url?: string;
      cta_text?: string;
      cta_link?: string;
      display_mode?: "watch_cta" | "behind_hero";
      duration?: number;
      is_active?: boolean;
      sort_order?: number;
    },
    adminUserId: string,
    req: Request
  ) {
    const row = await this.getById(id);

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.subtitle !== undefined) data.subtitle = input.subtitle;
    if (input.video_url !== undefined) {
      if (input.video_url !== row.video_url && row.video_url) {
        const key = extractKeyFromUrl(row.video_url);
        if (key) await deleteObject(key).catch(() => {});
      }
      data.video_url = input.video_url;
    }
    if (input.thumbnail_url !== undefined) {
      if (input.thumbnail_url !== row.thumbnail_url && row.thumbnail_url) {
        const key = extractKeyFromUrl(row.thumbnail_url);
        if (key) await deleteObject(key).catch(() => {});
      }
      data.thumbnail_url = input.thumbnail_url;
    }
    if (input.cta_text !== undefined) data.cta_text = input.cta_text;
    if (input.cta_link !== undefined) data.cta_link = input.cta_link;
    if (input.display_mode !== undefined) data.display_mode = input.display_mode;
    if (input.duration !== undefined) data.duration = input.duration;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (input.sort_order !== undefined) data.sort_order = input.sort_order;

    if (Object.keys(data).length > 0) {
      await videoAdRepo.updateVideoAd(id, data as never);
    }

    await auditService.record(
      { userId: adminUserId, action: "VIDEO_AD_UPDATED", entityType: "video_ad", entityId: id, newValues: data },
      req
    );
    return this.getById(id);
  },

  async publish(id: string, adminUserId: string, req: Request) {
    await this.getById(id);
    const updated = await videoAdRepo.updateVideoAd(id, { is_active: true });
    await auditService.record(
      { userId: adminUserId, action: "VIDEO_AD_PUBLISHED", entityType: "video_ad", entityId: id },
      req
    );
    return updated;
  },

  async unpublish(id: string, adminUserId: string, req: Request) {
    await this.getById(id);
    const updated = await videoAdRepo.updateVideoAd(id, { is_active: false });
    await auditService.record(
      { userId: adminUserId, action: "VIDEO_AD_UNPUBLISHED", entityType: "video_ad", entityId: id },
      req
    );
    return updated;
  },

  async remove(id: string, adminUserId: string, req: Request) {
    const row = await this.getById(id);
    if (row.video_url) {
      const key = extractKeyFromUrl(row.video_url);
      if (key) await deleteObject(key).catch(() => {});
    }
    if (row.thumbnail_url) {
      const key = extractKeyFromUrl(row.thumbnail_url);
      if (key) await deleteObject(key).catch(() => {});
    }
    await videoAdRepo.softDelete(id);
    await auditService.record(
      { userId: adminUserId, action: "VIDEO_AD_DELETED", entityType: "video_ad", entityId: id },
      req
    );
    return { success: true };
  },
};
