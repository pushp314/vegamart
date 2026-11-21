import { Router, Request, Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import asyncHandler from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { createRealtimeTicket } from "../../services/realtime-ticket.service";

const router = Router();

/**
 * @swagger
 * /realtime/ticket:
 *   post:
 *     summary: Generate a single-use, short-lived ticket for WebSocket connection
 *     tags: [Realtime]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ticket generated successfully
 */
router.post(
  "/ticket",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await createRealtimeTicket(req.user!);
    return sendSuccess(res, { ticket, expires_in: 30 }, { message: "Realtime ticket generated." });
  })
);

export default router;
