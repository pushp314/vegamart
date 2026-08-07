import { Router } from "express";

import {
  deactivateMe,
  getMe,
  listMySessions,
  revokeAllSessions,
  revokeSession,
  updateMe,
} from "../../controllers/user.controller";
import { authenticate, blockGuest } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate";
import { sessionParamsSchema, updateProfileSchema } from "../../validators/user.validators";

const router = Router();

router.use(authenticate);

router.get("/me", getMe);
router.patch("/me", blockGuest, validate({ body: updateProfileSchema }), updateMe);
router.put("/me", blockGuest, validate({ body: updateProfileSchema }), updateMe);
router.delete("/me", blockGuest, deactivateMe);
router.get("/me/sessions", listMySessions);
router.delete("/me/sessions/:session_id", validate({ params: sessionParamsSchema }), revokeSession);
router.delete("/me/sessions", revokeAllSessions);

export default router;
