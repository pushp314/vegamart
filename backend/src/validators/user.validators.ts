import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, "Phone must be 10-15 digits, optionally prefixed with +.")
    .optional()
    .nullable(),
  avatar_url: z.string().url("avatar_url must be a valid URL.").optional().nullable(),
}).strict();

export const sessionParamsSchema = z.object({
  session_id: z.string().uuid("session_id must be a valid UUID."),
}).strict();

export const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
}).strict();

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;

export function resolvePagination(query: { page?: number; per_page?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const per_page = Math.min(MAX_PAGE_SIZE, Math.max(1, query.per_page ?? DEFAULT_PAGE_SIZE));
  return { page, per_page, skip: (page - 1) * per_page, take: per_page };
}
