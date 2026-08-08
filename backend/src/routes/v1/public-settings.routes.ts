import { Router } from "express";

import { getPublicSettings } from "../../controllers/settings.controller";
import { listPublicHeroSlides } from "../../controllers/hero-slide.controller";
import { listPublicVideoAds } from "../../controllers/video-ad.controller";
import { validate } from "../../middlewares/validate";
import { heroSlideQuerySchema } from "../../validators/admin.validators";

const router = Router();

router.get("/settings/public", getPublicSettings);

// Public hero slides endpoint (no authentication required)
router.get("/hero-slides/public", validate({ query: heroSlideQuerySchema }), listPublicHeroSlides);

// Public active video ads endpoint
router.get("/video-ads/public", listPublicVideoAds);

export default router;
