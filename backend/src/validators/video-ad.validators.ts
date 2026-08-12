import { z } from "zod";

export const createVideoAdSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  subtitle: z.string().max(300).optional().nullable(),
  video_url: z.string().url("Invalid video URL"),
  thumbnail_url: z.string().url("Invalid thumbnail URL").optional().nullable(),
  cta_text: z.string().max(100).optional(),
  cta_link: z.string().max(500).optional().nullable(),
  display_mode: z.enum(["watch_cta", "behind_hero", "fixed_video"]).optional().default("watch_cta"),
  duration: z.number().int().positive().optional().default(30),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export const updateVideoAdSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  subtitle: z.string().max(300).optional().nullable(),
  video_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional().nullable(),
  cta_text: z.string().max(100).optional().nullable(),
  cta_link: z.string().max(500).optional().nullable(),
  display_mode: z.enum(["watch_cta", "behind_hero", "fixed_video"]).optional(),
  duration: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const videoAdIdParamsSchema = z.object({
  ad_id: z.string().uuid("Invalid video ad ID format"),
});

export const videoAdQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().optional(),
  q: z.string().optional(),
  is_active: z.enum(["true", "false"]).optional(),
  display_mode: z.enum(["watch_cta", "behind_hero", "fixed_video"]).optional(),
});
