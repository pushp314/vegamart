import { z } from "zod";

export const enableMaintenanceSchema = z.object({
  message: z
    .string()
    .trim()
    .min(3, "Maintenance message must be at least 3 characters.")
    .max(2000, "Maintenance message must be at most 2000 characters.")
    .optional(),
});

export const updateMaintenanceMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(3, "Maintenance message must be at least 3 characters.")
    .max(2000, "Maintenance message must be at most 2000 characters."),
});

export const issueDeveloperTokenSchema = z.object({
  apiKey: z.string().min(10, "API key must be at least 10 characters."),
});

export const listAuditLogsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
