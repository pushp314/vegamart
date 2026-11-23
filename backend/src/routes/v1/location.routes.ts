import { Router } from "express";
import { getServiceableCities } from "../../controllers/location.controller";

const router = Router();

router.get("/cities", getServiceableCities);

export default router;
