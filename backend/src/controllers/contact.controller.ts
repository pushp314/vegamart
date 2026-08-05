import type { Request, Response } from "express";

import { supportService } from "../services/support.service";
import { sendCreated } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import type { ContactBody } from "../validators/contact.validators";

/**
 * @swagger
 * /contact:
 *   post:
 *     summary: Submit a message to support
 *     security:
 *       - bearerAuth: []
 *     tags: [Support]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               subject: { type: string }
 *               message: { type: string }
 *     responses:
 *       201:
 *         description: Support message received.
 */
export const submitContact = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ContactBody;
  const ticket = await supportService.createContactTicket(req.user!.id, body);
  return sendCreated(
    res,
    ticket,
    "Your message has been received. Our team will get back to you shortly."
  );
});
