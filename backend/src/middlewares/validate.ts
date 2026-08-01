import type { NextFunction, Request, Response } from "express";
import type { ZodType, ZodTypeDef } from "zod";

import { ValidationError } from "../utils/ApiError";

interface ValidationSchemas {
  body?: ZodType<unknown, ZodTypeDef, unknown>;
  query?: ZodType<unknown, ZodTypeDef, unknown>;
  params?: ZodType<unknown, ZodTypeDef, unknown>;
  headers?: ZodType<unknown, ZodTypeDef, unknown>;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Array<{ path: string[]; message: string }> = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(...result.error.issues.map((i) => ({
          path: ["params", ...i.path.map(String)],
          message: i.message,
        })));
      } else {
        Object.assign(req.params, result.data);
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(...result.error.issues.map((i) => ({
          path: ["query", ...i.path.map(String)],
          message: i.message,
        })));
      } else {
        Object.assign(req.query, result.data);
      }
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...result.error.issues.map((i) => ({
          path: ["body", ...i.path.map(String)],
          message: i.message,
        })));
      } else {
        req.body = result.data;
      }
    }

    if (schemas.headers) {
      const result = schemas.headers.safeParse(req.headers);
      if (!result.success) {
        errors.push(...result.error.issues.map((i) => ({
          path: ["headers", ...i.path.map(String)],
          message: i.message,
        })));
      }
    }

    if (errors.length > 0) {
      const details: Record<string, string> = {};
      for (const err of errors) {
        const key = err.path.join(".");
        if (!details[key]) details[key] = err.message;
      }
      return next(new ValidationError(details));
    }

    next();
  };
}
