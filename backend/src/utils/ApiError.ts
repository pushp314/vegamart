import { HttpStatus, HttpStatusCode } from "./httpStatus";

export interface ApiErrorOptions {
  code?: string;
  details?: Record<string, string>;
  expose?: boolean;
  cause?: unknown;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, string>;
  public readonly expose: boolean;
  public readonly isOperational: boolean;

  constructor(
    statusCode: HttpStatusCode,
    message: string,
    options: ApiErrorOptions = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = options.code ?? defaultCodeForStatus(statusCode);
    this.details = options.details;
    this.expose = options.expose ?? true;
    this.isOperational = true;
    if (options.cause) {
      this.cause = options.cause;
    }
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, options?: ApiErrorOptions) {
    return new ApiError(HttpStatus.BAD_REQUEST, message, options);
  }

  static unauthorized(message = "Authentication required.", options?: ApiErrorOptions) {
    return new ApiError(HttpStatus.UNAUTHORIZED, message, {
      code: "UNAUTHORIZED",
      ...options,
    });
  }

  static forbidden(message = "Insufficient permissions.", options?: ApiErrorOptions) {
    return new ApiError(HttpStatus.FORBIDDEN, message, {
      code: "FORBIDDEN",
      ...options,
    });
  }

  static notFound(message = "Resource not found.", options?: ApiErrorOptions) {
    return new ApiError(HttpStatus.NOT_FOUND, message, {
      code: "NOT_FOUND",
      ...options,
    });
  }

  static conflict(message: string, options?: ApiErrorOptions) {
    return new ApiError(HttpStatus.CONFLICT, message, {
      code: "CONFLICT",
      ...options,
    });
  }

  static unprocessable(message: string, options?: ApiErrorOptions) {
    return new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, message, {
      code: "VALIDATION_ERROR",
      ...options,
    });
  }

  static tooManyRequests(message = "Too many requests, please slow down.", options?: ApiErrorOptions) {
    return new ApiError(HttpStatus.TOO_MANY_REQUESTS, message, {
      code: "RATE_LIMITED",
      ...options,
    });
  }

  static internal(message = "Internal server error.", options?: ApiErrorOptions) {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, message, {
      code: "INTERNAL_SERVER_ERROR",
      expose: false,
      ...options,
    });
  }
}

export class ValidationError extends ApiError {
  constructor(details?: Record<string, string>, message = "Validation failed.") {
    super(HttpStatus.UNPROCESSABLE_ENTITY, message, {
      code: "VALIDATION_ERROR",
      details,
    });
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found.") {
    super(HttpStatus.NOT_FOUND, message, { code: "NOT_FOUND" });
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication required.") {
    super(HttpStatus.UNAUTHORIZED, message, { code: "UNAUTHORIZED" });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Insufficient permissions.") {
    super(HttpStatus.FORBIDDEN, message, { code: "FORBIDDEN" });
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(HttpStatus.CONFLICT, message, { code: "CONFLICT" });
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApiError {
  constructor(message = "Too many requests, please slow down.") {
    super(HttpStatus.TOO_MANY_REQUESTS, message, { code: "RATE_LIMITED" });
    this.name = "RateLimitError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "BAD_REQUEST";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return "VALIDATION_ERROR";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "RATE_LIMITED";
    case HttpStatus.SERVICE_UNAVAILABLE:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}
