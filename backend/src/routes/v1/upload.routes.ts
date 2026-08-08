import { Router } from "express";

import { deleteImage, uploadDocument, uploadImage, uploadVideo } from "../../controllers/upload.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { ROLES } from "../../constants/roles";
import { upload, videoUpload } from "../../middlewares/upload.middleware";
import { validate } from "../../middlewares/validate";
import { deleteFileSchema, uploadFolderSchema } from "../../validators/upload.validators";

const router = Router();

// Any authenticated user may upload; role-specific quotas/guards can be layered later.
router.post(
  "/upload/image",
  authenticate,
  upload.single("file"),
  validate({ body: uploadFolderSchema }),
  uploadImage
);
// Frontend-compatible alias: POST /uploads (multipart "file")
router.post(
  "/uploads",
  authenticate,
  upload.single("file"),
  validate({ body: uploadFolderSchema }),
  uploadImage
);
router.post(
  "/upload/video",
  authenticate,
  requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.VENDOR),
  videoUpload.single("file"),
  uploadVideo
);
router.post(
  "/upload/document",
  authenticate,
  requireRole(ROLES.VENDOR, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  upload.single("file"),
  validate({ body: uploadFolderSchema }),
  uploadDocument
);
router.delete(
  "/upload/image",
  authenticate,
  validate({ body: deleteFileSchema }),
  deleteImage
);

export default router;
