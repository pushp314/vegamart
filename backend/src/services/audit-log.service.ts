import * as auditRepo from "../repositories/audit-log.repository";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

export const auditLogService = {
  async list(query: {
    page?: number;
    per_page?: number;
    q?: string;
    action?: string;
    entity_type?: string;
    entity_id?: string;
    user_id?: string;
    from?: string;
    to?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));

    let from: Date | undefined;
    let to: Date | undefined;
    if (query.from) {
      const parsed = new Date(query.from);
      if (!Number.isNaN(parsed.getTime())) from = parsed;
    }
    if (query.to) {
      const parsed = new Date(query.to);
      if (!Number.isNaN(parsed.getTime())) to = parsed;
    }

    const { rows, total } = await auditRepo.listAuditLogs(
      {
        userId: query.user_id,
        action: query.action,
        entityType: query.entity_type,
        entityId: query.entity_id,
        from,
        to,
        q: query.q,
      },
      (page - 1) * perPage,
      perPage
    );
    return { rows, total, page, perPage };
  },

  async getById(id: string) {
    const row = await auditRepo.findAuditLogById(id);
    if (!row) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Audit log not found.", { code: "NOT_FOUND" });
    }
    return row;
  },
};
