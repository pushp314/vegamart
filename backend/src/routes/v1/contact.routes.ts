import { Router } from "express";

import { submitContact } from "../../controllers/contact.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate";
import { contactSchema } from "../../validators/contact.validators";

const router = Router();

router.post("/contact", authenticate, validate({ body: contactSchema }), submitContact);

export default router;
