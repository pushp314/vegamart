import type { Request, Response } from "express";

import { videoAdService } from "../services/video-ad.service";
import { sendCreated, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";

export const listVideoAds = asyncHandler(async (req: Request, res: Response) => {
  const result = await videoAdService.list(req.query as never);
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

export const listPublicVideoAds = asyncHandler(async (_req: Request, res: Response) => {
  const data = await videoAdService.listPublic();
  return sendSuccess(res, data);
});

export const createVideoAd = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    title: string;
    subtitle?: string;
    video_url: string;
    thumbnail_url?: string;
    cta_text?: string;
    cta_link?: string;
    display_mode?: "watch_cta" | "behind_hero" | "fixed_video";
    duration?: number;
    is_active?: boolean;
    sort_order?: number;
  };
  const data = await videoAdService.create(
    {
      title: body.title,
      subtitle: body.subtitle,
      video_url: body.video_url,
      thumbnail_url: body.thumbnail_url,
      cta_text: body.cta_text,
      cta_link: body.cta_link,
      display_mode: body.display_mode,
      duration: body.duration,
      is_active: body.is_active,
      sort_order: body.sort_order,
    },
    req.user!.id,
    req
  );
  return sendCreated(res, data, "Video ad created.");
});

export const getVideoAd = asyncHandler(async (req: Request, res: Response) => {
  const data = await videoAdService.getById(req.params.ad_id as string);
  return sendSuccess(res, data);
});

export const updateVideoAd = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    title?: string;
    subtitle?: string;
    video_url?: string;
    thumbnail_url?: string;
    cta_text?: string;
    cta_link?: string;
    display_mode?: "watch_cta" | "behind_hero" | "fixed_video";
    duration?: number;
    is_active?: boolean;
    sort_order?: number;
  };
  const data = await videoAdService.update(
    req.params.ad_id as string,
    body,
    req.user!.id,
    req
  );
  return sendSuccess(res, data);
});

export const publishVideoAd = asyncHandler(async (req: Request, res: Response) => {
  const data = await videoAdService.publish(req.params.ad_id as string, req.user!.id, req);
  return sendSuccess(res, data);
});

export const unpublishVideoAd = asyncHandler(async (req: Request, res: Response) => {
  const data = await videoAdService.unpublish(req.params.ad_id as string, req.user!.id, req);
  return sendSuccess(res, data);
});

export const deleteVideoAd = asyncHandler(async (req: Request, res: Response) => {
  const data = await videoAdService.remove(req.params.ad_id as string, req.user!.id, req);
  return sendSuccess(res, data);
});
