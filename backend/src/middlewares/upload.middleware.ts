import multer from "multer";

import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

function isAscii(name: string): boolean {
  for (let i = 0; i < name.length; i += 1) {
    const code = name.charCodeAt(i);
    if (code > 0x7f) {
      return false;
    }
  }
  return true;
}

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB ceiling; per-kind limits enforced in service
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname || !isAscii(file.originalname)) {
      return cb(new ApiError(HttpStatus.BAD_REQUEST, "Filename must be ASCII-only."));
    }
    cb(null, true);
  },
});

export const videoUpload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200 MB for video files
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname || !isAscii(file.originalname)) {
      return cb(new ApiError(HttpStatus.BAD_REQUEST, "Filename must be ASCII-only."));
    }
    cb(null, true);
  },
});

export function multerErrorHandler(err: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }): boolean {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: { code: "FILE_TOO_LARGE", message: "File exceeds the maximum allowed size." },
      });
      return true;
    }
    res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      error: { code: "UPLOAD_ERROR", message: err.message },
    });
    return true;
  }
  return false;
}
