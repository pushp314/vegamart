import { Router } from "express";

import {
  createCategory,
  deleteCategory,
  getCategory,
  getCategoryBySlug,
  listCategories,
  updateCategory,
} from "../../controllers/category.controller";
import { requirePermission } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../constants/roles";
import {
  categoryIdParamsSchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "../../validators/category.validators";

const router = Router();

router.get("/categories", validate({ query: listCategoriesQuerySchema }), listCategories);
router.get("/categories/by-slug/:slug", getCategoryBySlug);
router.get("/categories/:category_id", validate({ params: categoryIdParamsSchema }), getCategory);
router.post(
  "/categories",
  requirePermission(PERMISSIONS.CATEGORIES_CREATE),
  validate({ body: createCategorySchema }),
  createCategory
);
router.patch(
  "/categories/:category_id",
  requirePermission(PERMISSIONS.CATEGORIES_UPDATE),
  validate({ params: categoryIdParamsSchema, body: updateCategorySchema }),
  updateCategory
);
router.delete(
  "/categories/:category_id",
  requirePermission(PERMISSIONS.CATEGORIES_DELETE),
  validate({ params: categoryIdParamsSchema }),
  deleteCategory
);

export default router;
