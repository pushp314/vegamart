import { Router } from "express";
import { z } from "zod";

import { createBroadcast, deleteBroadcast, listBroadcasts } from "../../controllers/broadcast.controller";
import { validate } from "../../middlewares/validate";

const router = Router();

const createBroadcastSchema = z.object({
  vendor_id: z.string().uuid().nullish(),
  vendor_name: z.string().trim().min(1).max(160),
  vendor_type: z.enum(["roaming", "shop"]),
  phone: z.string().trim().max(20).nullish(),
  street: z.string().trim().min(1).max(300),
  arrival_time: z.string().trim().min(1).max(120),
  produce: z.string().trim().min(1).max(300),
  note: z.string().nullish(),
});

const broadcastIdParamsSchema = z.object({
  id: z.string().uuid(),
});

router.get("/broadcasts", listBroadcasts);
router.post("/broadcasts", validate({ body: createBroadcastSchema }), createBroadcast);
router.delete("/broadcasts/:id", validate({ params: broadcastIdParamsSchema }), deleteBroadcast);

export default router;
