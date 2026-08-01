import { Router } from "express";

import { autocomplete, nearbyProducts, search } from "../../controllers/search.controller";
import { validate } from "../../middlewares/validate";
import { autocompleteQuerySchema, nearbyProductsQuerySchema, searchQuerySchema } from "../../validators/search.validators";

const router = Router();

router.get("/search", validate({ query: searchQuerySchema }), search);
router.get("/search/autocomplete", validate({ query: autocompleteQuerySchema }), autocomplete);
router.get("/search/nearby-products", validate({ query: nearbyProductsQuerySchema }), nearbyProducts);

export default router;
