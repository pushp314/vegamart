import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";

import log from "../config/logger";
import { isApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

interface PrismaKnownError extends Error {
  code: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    typeof error.code === "string"
  );
}

function isPrismaValidationError(error: unknown): error is Prisma.PrismaClientValidationError {
  return error instanceof Prisma.PrismaClientValidationError;
}

function isPrismaInitializationError(error: unknown): error is Error {
  return error instanceof Prisma.PrismaClientInitializationError;
}

function isBodyParserError(error: ErrorWithStatus): boolean {
  return "type" in error && error.type === "entity.parse.failed";
}

function isMulterError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code in ["LIMIT_FILE_SIZE", "LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE"]
  );
}

function handlePrismaError(error: unknown): { status: number; code: string; message: string; details?: Record<string, string> } {
  if (isPrismaKnownError(error)) {
    switch (error.code) {
      case "P2002": {
        const target = (error.meta?.target as string[]) ?? [];
        const fields = target.join(", ");
        return {
          status: HttpStatus.CONFLICT,
          code: "DUPLICATE_ENTRY",
          message: `Resource already exists${fields ? ` (${fields})` : ""}.`,
          details: { fields },
        };
      }
      case "P2003": {
        return {
          status: HttpStatus.CONFLICT,
          code: "FK_CONSTRAINT_VIOLATION",
          message: "Operation violates a referential constraint.",
        };
      }
      case "P2025":
        return {
          status: HttpStatus.NOT_FOUND,
          code: "NOT_FOUND",
          message: "The requested resource was not found.",
        };
      case "P2010":
      case "P2024":
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          code: "DATABASE_ERROR",
          message: "Database is temporarily unavailable. Please retry.",
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          code: "DATABASE_CONSTRAINT",
          message: "Database constraint violated.",
        };
    }
  }

  if (isPrismaValidationError(error)) {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: "PRISMA_VALIDATION_ERROR",
      message: "Malformed query.",
    };
  }

  if (isPrismaInitializationError(error)) {
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: "DATABASE_UNAVAILABLE",
      message: "Database connection is unavailable.",
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error.",
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(HttpStatus.NOT_FOUND).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} not found.`,
    },
    requestId: req.requestId,
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId;

  if (isBodyParserError(err as ErrorWithStatus)) {
    log.warn("Invalid JSON body", { requestId, path: req.originalUrl, err: err instanceof Error ? err.message : undefined });
    res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON." },
      requestId,
    });
    return;
  }

  if (isMulterError(err)) {
    log.warn("File upload rejected", { requestId, code: err.code });
    res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      error: { code: "UPLOAD_ERROR", message: err.message },
      requestId,
    });
    return;
  }

  if (isApiError(err)) {
    log[err.statusCode >= 500 ? "error" : "warn"](
      `[${err.code}] ${err.message}`,
      { requestId, status: err.statusCode, path: req.originalUrl, stack: err.stack }
    );
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.expose ? err.message : "Internal server error.",
        ...(err.details ? { details: err.details } : {}),
      },
      requestId,
    });
    return;
  }

  const prismaError = handlePrismaError(err);
  if (prismaError.status >= 500) {
    log.error("Unhandled error", {
      requestId,
      path: req.originalUrl,
      error: err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : String(err),
    });
  } else {
    log.warn("Database error", { requestId, code: prismaError.code, message: prismaError.message });
  }

  res.status(prismaError.status).json({
    success: false,
    error: {
      code: prismaError.code,
      message: prismaError.message,
      ...(prismaError.details ? { details: prismaError.details } : {}),
    },
    requestId,
  });
}
