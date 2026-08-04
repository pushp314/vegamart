import { Router } from "express";
import { z } from "zod";

import { createBroadcast, deleteBroadcast, listBroadcasts } from "../../controllers/broadcast.controller";
import { ROLES } from "../../constants/roles";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";

const router = Router();

const createBroadcastSchema = z.object({
  street: z.string().trim().min(1).max(300),
  arrival_time: z.string().trim().min(1).max(120),
  produce: z.string().trim().min(1).max(300),
  note: z.string().nullish(),
});

const broadcastIdParamsSchema = z.object({
  id: z.string().uuid(),
});

router.get("/broadcasts", listBroadcasts);
router.post("/broadcasts", authenticate, requireRole(ROLES.VENDOR), validate({ body: createBroadcastSchema }), createBroadcast);
router.delete("/broadcasts/:id", authenticate, requireRole(ROLES.VENDOR), validate({ params: broadcastIdParamsSchema }), deleteBroadcast);

export default router;
