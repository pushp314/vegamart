import { Router } from "express";
import { getServiceableCities, reverseGeocode } from "../../controllers/location.controller";

const router = Router();

router.get("/cities", getServiceableCities);
router.get("/reverse-geocode", reverseGeocode);

export default router;
