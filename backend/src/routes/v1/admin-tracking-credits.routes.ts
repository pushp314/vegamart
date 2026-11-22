import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { ROLES } from "../../constants/roles";
import {
  getTrackingWallet,
  getTrackingUsageLogs,
  addTrackingCredits,
} from "../../controllers/admin-tracking-credits.controller";

const router = Router();

// Only admin / super_admin can view credit wallet and usage details
router.use(authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN));

router.get("/wallet", getTrackingWallet);
router.get("/logs", getTrackingUsageLogs);
router.post("/recharge", addTrackingCredits);

export default router;
