import type { Request, Response } from "express";

import { heroSlideService } from "../services/hero-slide.service";
import { sendCreated, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";

/**
 * @swagger
 * /admin/hero-slides:
 *   get:
 *     summary: List hero slides
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: is_active
 *         schema: { type: string, enum: [true, false] }
 *     responses:
 *       200:
 *         description: Paginated hero slide list.
 */
export const listHeroSlides = asyncHandler(async (req: Request, res: Response) => {
  const result = await heroSlideService.list(req.query as never);
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /admin/hero-slides:
 *   post:
 *     summary: Create a hero slide
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               subtitle: { type: string, maxLength: 300 }
 *               body: { type: string }
 *               image_url: { type: string, maxLength: 500 }
 *               link_url: { type: string, maxLength: 500 }
 *               link_text: { type: string, maxLength: 100 }
 *               is_active: { type: boolean }
 *               sort_order: { type: integer }
 *     responses:
 *       201:
 *         description: Hero slide created.
 */
export const createHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    title: string;
    subtitle?: string;
    body?: string;
    image_url?: string;
    link_url?: string;
    link_text?: string;
    is_active?: boolean;
    sort_order?: number;
  };
  const data = await heroSlideService.create(
    {
      title: body.title,
      subtitle: body.subtitle,
      body: body.body,
      image_url: body.image_url,
      link_url: body.link_url,
      link_text: body.link_text,
      is_active: body.is_active,
      sort_order: body.sort_order,
    },
    req.user!.id,
    req
  );
  return sendCreated(res, data, "Hero slide created.");
});

/**
 * @swagger
 * /admin/hero-slides/{slide_id}:
 *   get:
 *     summary: Get a hero slide
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: slide_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Hero slide details.
 */
export const getHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const data = await heroSlideService.getById(req.params.slide_id as string);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/hero-slides/{slide_id}:
 *   patch:
 *     summary: Update a hero slide
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: slide_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               subtitle: { type: string, maxLength: 300 }
 *               body: { type: string }
 *               image_url: { type: string, maxLength: 500 }
 *               link_url: { type: string, maxLength: 500 }
 *               link_text: { type: string, maxLength: 100 }
 *               is_active: { type: boolean }
 *               sort_order: { type: integer }
 *     responses:
 *       200:
 *         description: Hero slide updated.
 */
export const updateHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    title?: string;
    subtitle?: string;
    body?: string;
    image_url?: string;
    link_url?: string;
    link_text?: string;
    is_active?: boolean;
    sort_order?: number;
  };
  const data = await heroSlideService.update(
    req.params.slide_id as string,
    {
      title: body.title,
      subtitle: body.subtitle,
      body: body.body,
      image_url: body.image_url,
      link_url: body.link_url,
      link_text: body.link_text,
      is_active: body.is_active,
      sort_order: body.sort_order,
    },
    req.user!.id,
    req
  );
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/hero-slides/{slide_id}/publish:
 *   post:
 *     summary: Publish a hero slide
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: slide_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Hero slide published.
 */
export const publishHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const data = await heroSlideService.publish(req.params.slide_id as string, req.user!.id, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/hero-slides/{slide_id}/unpublish:
 *   post:
 *     summary: Unpublish a hero slide
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: slide_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Hero slide unpublished.
 */
export const unpublishHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const data = await heroSlideService.unpublish(req.user!.id, req.params.slide_id as string, req);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /admin/hero-slides/{slide_id}:
 *   delete:
 *     summary: Delete a hero slide
 *     security:
 *       - bearerAuth: []
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: slide_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Hero slide deleted.
 */
export const deleteHeroSlide = asyncHandler(async (req: Request, res: Response) => {
  const data = await heroSlideService.remove(req.user!.id, req.params.slide_id as string, req);
  return sendSuccess(res, data);
});