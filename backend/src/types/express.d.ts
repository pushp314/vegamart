import type { AuthUser } from "./index";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthUser;
      correlationId?: string;
    }
  }
}

export {};
