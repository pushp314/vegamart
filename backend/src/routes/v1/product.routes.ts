import { Router } from "express";

import {
  addProductImages,
  createProduct,
  createProductReview,
  deleteProduct,
  getProduct,
  listMyProducts,
  listProducts,
  removeProductImage,
  setPrimaryProductImage,
  updateProduct,
} from "../../controllers/product.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate";
import { ROLES } from "../../constants/roles";
import {
  createProductSchema,
  createReviewSchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  productImagesSchema,
  setPrimaryImageSchema,
  updateProductSchema,
  vendorProductsQuerySchema,
} from "../../validators/product.validators";

const router = Router();

router.get("/products", validate({ query: listProductsQuerySchema }), listProducts);
router.get("/products/me", authenticate, validate({ query: vendorProductsQuerySchema }), listMyProducts);
router.get("/products/:product_id", validate({ params: productIdParamsSchema }), getProduct);

router.post("/products", authenticate, requireRole(ROLES.VENDOR), validate({ body: createProductSchema }), createProduct);
router.patch("/products/:product_id", authenticate, validate({ params: productIdParamsSchema, body: updateProductSchema }), updateProduct);
router.delete("/products/:product_id", authenticate, validate({ params: productIdParamsSchema }), deleteProduct);
router.post(
  "/products/:product_id/images",
  authenticate,
  validate({ params: productIdParamsSchema, body: productImagesSchema }),
  addProductImages
);
router.delete(
  "/products/:product_id/images/:image_id",
  authenticate,
  validate({ params: productIdParamsSchema }),
  removeProductImage
);
router.put(
  "/products/:product_id/images/primary",
  authenticate,
  validate({ params: productIdParamsSchema, body: setPrimaryImageSchema }),
  setPrimaryProductImage
);

router.post(
  "/products/:product_id/reviews",
  authenticate,
  requireRole(ROLES.CUSTOMER),
  validate({ params: productIdParamsSchema, body: createReviewSchema }),
  createProductReview
);

export default router;
