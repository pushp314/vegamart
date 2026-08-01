import { Router } from "express";

import { getPublicSettings } from "../../controllers/settings.controller";

const router = Router();

router.get("/settings/public", getPublicSettings);

export default router;
