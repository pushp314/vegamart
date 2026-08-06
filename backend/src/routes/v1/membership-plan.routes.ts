import { Router } from "express";

import { listPublicMembershipPlans } from "../../controllers/membership-plan.controller";

const router = Router();

router.get("/membership-plans", listPublicMembershipPlans);

export default router;
