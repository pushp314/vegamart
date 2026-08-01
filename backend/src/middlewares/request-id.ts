import type { NextFunction, Request, Response } from "express";

import { newRequestId } from "../utils/pagination";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header("X-Request-ID");
  const id = incomingId && /^[a-zA-Z0-9-_]{8,64}$/.test(incomingId) ? incomingId : newRequestId();
  req.requestId = id;
  res.setHeader("X-Request-ID", id);
  next();
}
