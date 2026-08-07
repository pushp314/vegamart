import type { Request, Response } from "express";

import { sendNoContent, sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { userService } from "../services/user.service";
import type { UpdateProfileBody } from "../validators/user.validators";

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get the current user's profile
 *     security:
 *       - bearerAuth: []
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Profile returned.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getProfile(req.user!.id);
  return sendSuccess(res, user);
});

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Update the current user's profile
 *     security:
 *       - bearerAuth: []
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string, nullable: true }
 *               avatar_url: { type: string, format: url, nullable: true }
 *     responses:
 *       200:
 *         description: Profile updated.
 */
export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateProfileBody;
  const user = await userService.updateProfile(req.user!.id, body, req);
  return sendSuccess(res, user);
});

/**
 * @swagger
 * /users/me:
 *   delete:
 *     summary: Deactivate the current user's account
 *     security:
 *       - bearerAuth: []
 *     tags: [Users]
 *     responses:
 *       204:
 *         description: Account deactivated.
 */
export const deactivateMe = asyncHandler(async (req: Request, res: Response) => {
  await userService.deactivate(req.user!.id, req);
  return sendNoContent(res);
});

/**
 * @swagger
 * /users/me/sessions:
 *   get:
 *     summary: List active sessions
 *     security:
 *       - bearerAuth: []
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of sessions.
 */
export const listMySessions = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await userService.listSessions(req.user!.id);
  return sendSuccess(res, sessions);
});

/**
 * @swagger
 * /users/me/sessions/{session_id}:
 *   delete:
 *     summary: Revoke a specific session
 *     security:
 *       - bearerAuth: []
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: session_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Session revoked.
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  await userService.revokeSession(req.user!.id, req.params.session_id as string, req);
  return sendNoContent(res);
});

/**
 * @swagger
 * /users/me/sessions:
 *   delete:
 *     summary: Revoke all sessions
 *     security:
 *       - bearerAuth: []
 *     tags: [Users]
 *     responses:
 *       204:
 *         description: All sessions revoked.
 */
export const revokeAllSessions = asyncHandler(async (req: Request, res: Response) => {
  await userService.revokeAllSessions(req.user!.id, req);
  return sendNoContent(res);
});

export const toggleVendorSubscription = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.toggleVendorSubscription(req.user!.id, req.body.vendor_id);
  return sendSuccess(res, result, "Subscription updated");
});
