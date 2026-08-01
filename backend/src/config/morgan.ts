import morgan, { StreamOptions } from "morgan";
import type { Request, Response } from "express";

import log from "./logger";

const stream: StreamOptions = {
  write: (message: string) => {
    const cleaned = message.replace(/\n$/, "");
    log.http(cleaned);
  },
};

const skip = (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === "test") return true;
  return res.statusCode < 400;
};

export const httpLogger = morgan("combined", { stream, skip });
