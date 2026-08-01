import type { Request, Response } from "express";

import { searchService } from "../services/search.service";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildPaginationMeta } from "../utils/pagination";

/**
 * @swagger
 * /search:
 *   get:
 *     summary: Search products and vendors
 *     description: Full-text style search across product names, descriptions, tags and vendor business names. Results are relevance-ranked.
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [products, vendors, all], default: all }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Search results with products and/or vendors.
 */
export const search = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { q?: string; type?: string; page?: string; per_page?: string };
  const type = (query.type as "products" | "vendors" | "all") ?? "all";
  const page = query.page ? Number(query.page) : 1;
  const perPage = query.per_page ? Number(query.per_page) : 20;
  const result = await searchService.search(query.q ?? "", type, page, perPage);
  return sendSuccess(res, {
    products: result.products,
    vendors: result.vendors,
    query: query.q ?? "",
  });
});

/**
 * @swagger
 * /search/autocomplete:
 *   get:
 *     summary: Autocomplete product and vendor names
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 8 }
 *     responses:
 *       200:
 *         description: Suggestion list.
 */
export const autocomplete = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { q?: string; limit?: string };
  const suggestions = await searchService.autocomplete(query.q ?? "", query.limit ? Number(query.limit) : 8);
  return sendSuccess(res, suggestions);
});

/**
 * @swagger
 * /search/nearby-products:
 *   get:
 *     summary: Search products sold by vendors that can deliver to a location
 *     description: Returns products within a delivery radius, each annotated with distance and estimated delivery time.
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: radius
 *         schema: { type: number, default: 5 }
 *       - in: query
 *         name: category_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Nearby products with distance and ETA.
 */
export const nearbyProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { lat?: string; lng?: string; radius?: string; category_id?: string; q?: string; page?: string; per_page?: string };
  const result = await searchService.nearbyProducts({
    lat: Number(query.lat),
    lng: Number(query.lng),
    radiusKm: query.radius ? Number(query.radius) : undefined,
    categoryId: query.category_id,
    q: query.q,
    page: query.page ? Number(query.page) : undefined,
    perPage: query.per_page ? Number(query.per_page) : undefined,
  });
  return sendSuccess(res, result.items, {
    pagination: buildPaginationMeta({ page: result.page, per_page: result.perPage }, result.total),
  });
});
