import type { AuthUser } from "./index";
import type { DeveloperIdentity } from "../modules/maintenance/maintenance.types";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthUser;
      correlationId?: string;
      maintenanceDeveloper?: DeveloperIdentity;
    }
  }
}

export {};
