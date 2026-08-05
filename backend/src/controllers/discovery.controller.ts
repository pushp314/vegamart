import type { Request, Response } from "express";

import { discoveryService } from "../services/discovery.service";
import { UnauthorizedError } from "../utils/ApiError";
import { sendSuccess, sendNoContent } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { GUEST_USER_ID } from "../constants";

const requireUserId = (req: Request): string => {
  const id = req.user?.id;
  if (!id || id === GUEST_USER_ID) {
    throw new UnauthorizedError("Authentication required.");
  }
  return id;
};

/**
 * @swagger
 * /discovery/favorites/{vendor_id}:
 *   post:
 *     summary: Toggle a vendor as favorite for the current customer
 *     security: [{ bearerAuth: [] }]
 *     tags: [Discovery]
 *     responses:
 *       200:
 *         description: Favorited state toggled.
 */
export const toggleFavorite = asyncHandler(async (req: Request, res: Response) => {
  const data = await discoveryService.favorite(requireUserId(req), req.params.vendor_id as string);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /discovery/favorites:
 *   get:
 *     summary: List the current customer's favorite vendors
 *     security: [{ bearerAuth: [] }]
 *     tags: [Discovery]
 *     responses:
 *       200:
 *         description: Favorite vendors list.
 */
export const listFavorites = asyncHandler(async (req: Request, res: Response) => {
  const data = await discoveryService.listFavorites(requireUserId(req));
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /discovery/follows/{vendor_id}:
 *   post:
 *     summary: Toggle following a vendor for the current customer
 *     security: [{ bearerAuth: [] }]
 *     tags: [Discovery]
 *     responses:
 *       200:
 *         description: Follow state toggled.
 */
export const toggleFollow = asyncHandler(async (req: Request, res: Response) => {
  const data = await discoveryService.follow(requireUserId(req), req.params.vendor_id as string);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /discovery/follows:
 *   get:
 *     summary: List vendors the current customer follows
 *     security: [{ bearerAuth: [] }]
 *     tags: [Discovery]
 *     responses:
 *       200:
 *         description: Followed vendors list.
 */
export const listFollows = asyncHandler(async (req: Request, res: Response) => {
  const data = await discoveryService.listFollows(requireUserId(req));
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /discovery/follows/{vendor_id}/status:
 *   get:
 *     summary: Get favorite/follow status for a vendor
 *     security: [{ bearerAuth: [] }]
 *     tags: [Discovery]
 *     responses:
 *       200:
 *         description: Follow and favorite status.
 */
export const getFollowStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await discoveryService.getStatus(requireUserId(req), req.params.vendor_id as string);
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /discovery/search-history:
 *   get:
 *     summary: List the current customer's recent nearby searches
 *     security: [{ bearerAuth: [] }]
 *     tags: [Discovery]
 *     responses:
 *       200:
 *         description: Recent search history.
 */
export const listSearchHistory = asyncHandler(async (req: Request, res: Response) => {
  const data = await discoveryService.listSearchHistory(requireUserId(req));
  return sendSuccess(res, data);
});

/**
 * @swagger
 * /discovery/search-history:
 *   delete:
 *     summary: Clear the current customer's nearby search history
 *     security: [{ bearerAuth: [] }]
 *     tags: [Discovery]
 *     responses:
 *       204:
 *         description: Search history cleared.
 */
export const clearSearchHistory = asyncHandler(async (req: Request, res: Response) => {
  await discoveryService.clearSearchHistory(requireUserId(req));
  return sendNoContent(res);
});

/**
 * @swagger
 * /vendors/{vendor_id}/history:
 *   get:
 *     summary: Get a vendor's broadcast location history (public)
 *     tags: [Discovery]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: Vendor location history.
 */
export const getVendorHistory = asyncHandler(async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 30;
  const data = await discoveryService.getVendorHistory(req.params.vendor_id as string, limit);
  return sendSuccess(res, data);
});
