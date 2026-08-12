import type { Request } from "express";

import { auditService } from "./audit.service";
import { cacheService } from "../database/cache";
import * as heroSlideRepo from "../repositories/hero-slide.repository";
import { deleteObject, extractKeyFromUrl } from "../storage/r2.client";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

export interface CreateHeroSlideInput {
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  link_text?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export const heroSlideService = {
  async list(query: {
    page?: number;
    per_page?: number;
    q?: string;
    is_active?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 10));
    const { rows, total } = await heroSlideRepo.listHeroSlides(
      {
        q: query.q,
        isActive: query.is_active === "true" ? true : query.is_active === "false" ? false : undefined,
      },
      (page - 1) * perPage,
      perPage
    );
    return { rows, total, page, perPage };
  },

  async getById(id: string) {
    const row = await heroSlideRepo.findById(id);
    if (!row) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Hero slide not found.", { code: "NOT_FOUND" });
    }
    return row;
  },

  async create(input: CreateHeroSlideInput, adminUserId: string, req: Request) {
    const row = await heroSlideRepo.createHeroSlide({
      title: input.title,
      subtitle: input.subtitle,
      body: input.body,
      image_url: input.image_url,
      link_url: input.link_url,
      link_text: input.link_text,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 0,
      created_by: adminUserId,
    });

    await cacheService.invalidateNamespace("settings");

    await auditService.record(
      { userId: adminUserId, action: "HERO_SLIDE_CREATED", entityType: "hero_slide", entityId: row.id, newValues: { title: row.title } },
      req
    );
    return row;
  },

  async update(
    id: string,
    input: {
      title?: string | null;
      subtitle?: string | null;
      body?: string | null;
      image_url?: string | null;
      link_url?: string | null;
      link_text?: string | null;
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
    if (input.body !== undefined) data.body = input.body;
    if (input.image_url !== undefined) {
      if (input.image_url !== row.image_url && row.image_url) {
        const key = extractKeyFromUrl(row.image_url);
        if (key) await deleteObject(key).catch(() => {});
      }
      data.image_url = input.image_url;
    }
    if (input.link_url !== undefined) data.link_url = input.link_url;
    if (input.link_text !== undefined) data.link_text = input.link_text;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (input.sort_order !== undefined) data.sort_order = input.sort_order;

    if (Object.keys(data).length > 0) {
      await heroSlideRepo.updateHeroSlide(id, data as never);
      await cacheService.invalidateNamespace("settings");
    }

    await auditService.record(
      { userId: adminUserId, action: "HERO_SLIDE_UPDATED", entityType: "hero_slide", entityId: id, newValues: data },
      req
    );
    return this.getById(id);
  },

  async publish(id: string, adminUserId: string, req: Request) {
    await this.getById(id);
    const updated = await heroSlideRepo.updateHeroSlide(id, { is_active: true });
    await cacheService.invalidateNamespace("settings");
    await auditService.record(
      { userId: adminUserId, action: "HERO_SLIDE_PUBLISHED", entityType: "hero_slide", entityId: id },
      req
    );
    return updated;
  },

  async unpublish(id: string, adminUserId: string, req: Request) {
    await this.getById(id);
    const updated = await heroSlideRepo.updateHeroSlide(id, { is_active: false });
    await cacheService.invalidateNamespace("settings");
    await auditService.record(
      { userId: adminUserId, action: "HERO_SLIDE_UNPUBLISHED", entityType: "hero_slide", entityId: id },
      req
    );
    return updated;
  },

  async remove(id: string, adminUserId: string, req: Request) {
    const row = await this.getById(id);
    if (row.image_url) {
      const key = extractKeyFromUrl(row.image_url);
      if (key) await deleteObject(key).catch(() => {});
    }
    await heroSlideRepo.softDelete(id);
    await cacheService.invalidateNamespace("settings");
    await auditService.record(
      { userId: adminUserId, action: "HERO_SLIDE_DELETED", entityType: "hero_slide", entityId: id },
      req
    );
    return { success: true };
  },
};