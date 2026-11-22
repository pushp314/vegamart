import { Router, Request, Response } from "express";
import { optionalAuthenticate } from "../../middlewares/auth.middleware";
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
  optionalAuthenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user || {
      id: "anonymous",
      email: "guest@galiconnect.local",
      name: "Guest",
      role: "customer",
      role_id: "",
      permissions: [],
      vendor_id: null,
      delivery_id: null,
      is_verified: false,
      session_id: null,
    };
    const ticket = await createRealtimeTicket(user as any);
    return sendSuccess(res, { ticket, expires_in: 30 }, { message: "Realtime ticket generated." });
  })
);

export default router;
