import { z } from "zod";

const folderEnum = z.enum([
  "products",
  "vendors",
  "profiles",
  "categories",
  "documents",
  "invoices",
  "hero",
  "cms",
  "videos",
  "ads",
]);

export const uploadFolderSchema = z.object({
  folder: folderEnum,
}).strict();

export const deleteFileSchema = z.object({
  key: z.string().min(1, "key is required.").max(500),
}).strict();
