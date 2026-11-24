import { Router } from "express";
import { getServiceableCities, reverseGeocode, getDirections } from "../../controllers/location.controller";

const router = Router();

router.get("/cities", getServiceableCities);
router.get("/reverse-geocode", reverseGeocode);
router.get("/directions", getDirections);

export default router;
