import { Router } from "express";

import { getPublicSettings, getSettings, updateSettings } from "../../controllers/settings.controller";
import { listPublicHeroSlides } from "../../controllers/hero-slide.controller";
import { listPublicVideoAds } from "../../controllers/video-ad.controller";
import { validate } from "../../middlewares/validate";
import { heroSlideQuerySchema, settingsUpdateSchema } from "../../validators/admin.validators";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { ROLES } from "../../constants/roles";

const router = Router();

router.get("/settings/public", getPublicSettings);
router.get("/settings", getPublicSettings);

// Backwards-compatible aliases for admin settings
router.get("/settings/admin", authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), getSettings);
router.patch("/settings/admin", authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), validate({ body: settingsUpdateSchema }), updateSettings);
router.put("/settings/admin", authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), validate({ body: settingsUpdateSchema }), updateSettings);

// Public hero slides endpoint (no authentication required)
router.get("/hero-slides/public", validate({ query: heroSlideQuerySchema }), listPublicHeroSlides);

// Public active video ads endpoint
router.get("/video-ads/public", listPublicVideoAds);

export default router;
