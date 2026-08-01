import type { Response } from "express";

import { HttpStatus } from "./httpStatus";
import type { PaginationMeta } from "../types";

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; message?: string; pagination?: PaginationMeta } = {}
): Response {
  const { status = HttpStatus.OK, message, pagination } = options;
  const body: Record<string, unknown> = { success: true, data };
  if (message) body.message = message;
  if (pagination) body.pagination = pagination;
  return res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T, message?: string): Response {
  return sendSuccess(res, data, { status: HttpStatus.CREATED, message });
}

export function sendNoContent(res: Response): Response {
  return res.status(HttpStatus.NO_CONTENT).send();
}
