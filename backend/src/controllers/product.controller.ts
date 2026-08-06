import type { Request, Response } from "express";

import { productService } from "../services/product.service";
import { sendCreated, sendNoContent, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";
import { HttpStatus } from "../utils/httpStatus";
import prisma from "../database/prisma";
import type {
  CreateProductBody,
  CreateReviewBody,
  UpdateProductBody,
} from "../validators/product.validators";

export const getGalleryImages = asyncHandler(async (_req: Request, res: Response) => {
  const images = await prisma.productImage.findMany({
    distinct: ['url'],
    select: { url: true },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
  return sendSuccess(res, images.map(img => img.url));
});

/**
 * @swagger
 * /products:
 *   get:
 *     summary: List active products with filters and sorting
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: vendor_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: min_price
 *         schema: { type: number }
 *       - in: query
 *         name: max_price
 *         schema: { type: number }
 *       - in: query
 *         name: is_vegetarian
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [relevance, price_asc, price_desc, rating, newest, popularity] }
 *     responses:
 *       200:
 *         description: Paginated product list.
 */
export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | undefined>;
  const result = await productService.list({
    page: query.page ? Number(query.page) : undefined,
    per_page: query.per_page ? Number(query.per_page) : undefined,
    q: query.q,
    vendor_id: query.vendor_id,
    category_id: query.category_id,
    subcategory_id: query.subcategory_id,
    min_price: query.min_price ? Number(query.min_price) : undefined,
    max_price: query.max_price ? Number(query.max_price) : undefined,
    is_vegetarian: query.is_vegetarian,
    is_available: query.is_available,
    tag: query.tag,
    sort: query.sort,
  });
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /products/{product_id}:
 *   get:
 *     summary: Get a product by id
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product details with images.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getById(req.params.product_id as string);
  return sendSuccess(res, product);
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a product (vendor only)
 *     security:
 *       - bearerAuth: []
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category_id, price, mrp, unit]
 *             properties:
 *               name: { type: string }
 *               category_id: { type: string, format: uuid }
 *               subcategory_id: { type: string, format: uuid, nullable: true }
 *               description: { type: string, nullable: true }
 *               price: { type: number }
 *               mrp: { type: number }
 *               unit: { type: string }
 *               tag: { type: string, nullable: true }
 *               is_active: { type: boolean }
 *               is_vegetarian: { type: boolean, nullable: true }
 *               stock: { type: integer }
 *     responses:
 *       201:
 *         description: Product created.
 */
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.create(req.user!.id, req.body as CreateProductBody, req);
  return sendCreated(res, product);
});

/**
 * @swagger
 * /products/me:
 *   get:
 *     summary: List the vendor's own products
 *     security:
 *       - bearerAuth: []
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: include_inactive
 *         schema: { type: string, enum: ["true", "false"] }
 *     responses:
 *       200:
 *         description: Vendor's products.
 */
export const listMyProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { page?: string; per_page?: string; q?: string; include_inactive?: string };
  const result = await productService.listMyProducts(req.user!.id, {
    page: query.page ? Number(query.page) : undefined,
    per_page: query.per_page ? Number(query.per_page) : undefined,
    q: query.q,
    include_inactive: query.include_inactive,
  });
  return sendSuccess(res, result.rows, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});

/**
 * @swagger
 * /products/{product_id}:
 *   patch:
 *     summary: Update a product (vendor owner only)
 *     security:
 *       - bearerAuth: []
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Product updated.
 */
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.update(req.user!.id, req.params.product_id as string, req.body as UpdateProductBody, req);
  return sendSuccess(res, product);
});

/**
 * @swagger
 * /products/{product_id}:
 *   delete:
 *     summary: Soft-delete a product (vendor owner only)
 *     security:
 *       - bearerAuth: []
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Product deleted.
 */
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await productService.remove(req.user!.id, req.params.product_id as string, req);
  return sendNoContent(res);
});

/**
 * @swagger
 * /products/{product_id}/images:
 *   post:
 *     summary: Attach images to a product (vendor owner only)
 *     security:
 *       - bearerAuth: []
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [images]
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [url]
 *                   properties:
 *                     url: { type: string }
 *                     alt_text: { type: string, nullable: true }
 *                     is_primary: { type: boolean }
 *     responses:
 *       200:
 *         description: Images added.
 */
export const addProductImages = asyncHandler(async (req: Request, res: Response) => {
  const { images } = req.body as { images: Array<{ url: string; alt_text?: string | null; is_primary?: boolean }> };
  const product = await productService.addImages(req.user!.id, req.params.product_id as string, images, req);
  return sendSuccess(res, product, { status: HttpStatus.OK });
});

/**
 * @swagger
 * /products/{product_id}/images/{image_id}:
 *   delete:
 *     summary: Remove an image from a product
 *     security:
 *       - bearerAuth: []
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: image_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Image removed.
 */
export const removeProductImage = asyncHandler(async (req: Request, res: Response) => {
  await productService.removeImage(req.user!.id, req.params.product_id as string, req.params.image_id as string, req);
  return sendNoContent(res);
});

/**
 * @swagger
 * /products/{product_id}/images/primary:
 *   put:
 *     summary: Set the primary image for a product
 *     security:
 *       - bearerAuth: []
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [image_id]
 *             properties:
 *               image_id: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Primary image set.
 */
export const setPrimaryProductImage = asyncHandler(async (req: Request, res: Response) => {
  const { image_id } = req.body as { image_id: string };
  await productService.setPrimaryImage(req.user!.id, req.params.product_id as string, image_id, req);
  return sendSuccess(res, { primary_image_id: image_id });
});

/**
 * @swagger
 * /products/{product_id}/reviews:
 *   post:
 *     summary: Submit a review for a product
 *     security:
 *       - bearerAuth: []
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               title: { type: string }
 *               comment: { type: string }
 *               order_id: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Review created.
 */
export const createProductReview = asyncHandler(async (req: Request, res: Response) => {
  const { product_id } = req.params as { product_id: string };
  const body = req.body as CreateReviewBody;
  const review = await productService.createReview(req.user!.id, product_id, body, req);
  return sendCreated(res, review, "Review submitted successfully.");
});
