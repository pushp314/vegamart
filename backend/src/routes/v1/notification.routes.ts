import { Router } from "express";

import { listNotifications, markAllRead, markRead, removeNotification, unreadCount } from "../../controllers/notification.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate";
import { z } from "zod";

const router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(100).optional(),
  type: z
    .enum(["order", "payment", "promotional", "system", "delivery", "vendor"])
    .optional(),
});

const notificationIdParamsSchema = z.object({
  notification_id: z.string().uuid("notification_id must be a valid UUID."),
});

router.get("/notifications", authenticate, validate({ query: listQuerySchema }), listNotifications);
router.get("/notifications/unread-count", authenticate, unreadCount);
router.post("/notifications/read-all", authenticate, markAllRead);
router.put("/notifications/read-all", authenticate, markAllRead);
router.post("/notifications/:notification_id/read", authenticate, validate({ params: notificationIdParamsSchema }), markRead);
router.put("/notifications/:notification_id/read", authenticate, validate({ params: notificationIdParamsSchema }), markRead);
router.delete("/notifications/:notification_id", authenticate, validate({ params: notificationIdParamsSchema }), removeNotification);

export default router;
