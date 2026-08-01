import type { Request, Response } from "express";

import { categoryService } from "../services/category.service";
import { sendCreated, sendNoContent, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";
import type {
  CreateCategoryBody,
  UpdateCategoryBody,
} from "../validators/category.validators";

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: List categories (flat or tree)
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer }
 *       - in: query
 *         name: tree
 *         schema: { type: string, enum: ["true", "false"] }
 *         description: Return the category hierarchy as a nested tree.
 *       - in: query
 *         name: include_inactive
 *         schema: { type: string, enum: ["true", "false"] }
 *     responses:
 *       200:
 *         description: List of categories.
 */
export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { page?: string; per_page?: string; include_inactive?: string; tree?: string };
  const result = await categoryService.list({
    page: query.page ? Number(query.page) : undefined,
    per_page: query.per_page ? Number(query.per_page) : undefined,
    include_inactive: query.include_inactive,
    tree: query.tree,
  });

  if ("tree" in result) {
    return sendSuccess(res, result.tree);
  }

  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Create a category
 *     description: Admin / super_admin only.
 *     security:
 *       - bearerAuth: []
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               parent_id: { type: string, format: uuid, nullable: true }
 *               icon: { type: string, nullable: true }
 *               color: { type: string, nullable: true }
 *               image_url: { type: string, nullable: true }
 *               sort_order: { type: integer }
 *               is_active: { type: boolean }
 *               is_featured: { type: boolean }
 *     responses:
 *       201:
 *         description: Category created.
 */
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.create(req.body as CreateCategoryBody, req);
  return sendCreated(res, category);
});

/**
 * @swagger
 * /categories/{category_id}:
 *   get:
 *     summary: Get a category by id
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: category_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category details.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.getById(req.params.category_id as string);
  return sendSuccess(res, category);
});

/**
 * @swagger
 * /categories/by-slug/{slug}:
 *   get:
 *     summary: Get an active category by slug
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category details.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const getCategoryBySlug = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.getBySlug(req.params.slug as string);
  return sendSuccess(res, category);
});

/**
 * @swagger
 * /categories/{category_id}:
 *   patch:
 *     summary: Update a category
 *     description: Admin / super_admin only.
 *     security:
 *       - bearerAuth: []
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: category_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               parent_id: { type: string, format: uuid, nullable: true }
 *               icon: { type: string, nullable: true }
 *               color: { type: string, nullable: true }
 *               image_url: { type: string, nullable: true }
 *               sort_order: { type: integer }
 *               is_active: { type: boolean }
 *               is_featured: { type: boolean }
 *     responses:
 *       200:
 *         description: Category updated.
 */
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.update(req.params.category_id as string, req.body as UpdateCategoryBody, req);
  return sendSuccess(res, category);
});

/**
 * @swagger
 * /categories/{category_id}:
 *   delete:
 *     summary: Soft-delete a category
 *     description: Admin / super_admin only.
 *     security:
 *       - bearerAuth: []
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: category_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Category deleted.
 */
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await categoryService.remove(req.params.category_id as string, req);
  return sendNoContent(res);
});
