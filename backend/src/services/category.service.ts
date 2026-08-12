import type { Request } from "express";

import { env } from "../config";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as categoryRepo from "../repositories/category.repository";
import { cacheService } from "../database/cache";
import { ApiError, ConflictError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { uniqueSlug } from "../utils/slug";
import type { CreateCategoryBody, UpdateCategoryBody } from "../validators/category.validators";

export interface CategoryTreeNode {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  is_featured: boolean;
  children: CategoryTreeNode[];
}

function buildTree(rows: categoryRepo.CategoryRow[]): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>();
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] });
  }
  const roots: CategoryTreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export const categoryService = {
  async list(query: {
    page?: number;
    per_page?: number;
    include_inactive?: string;
    tree?: string;
  }) {
    const includeInactive = query.include_inactive === "true";
    const asTree = query.tree === "true";

    if (asTree) {
      const tree = await cacheService.remember<CategoryTreeNode[]>(
        "category",
        "tree:active",
        async () => buildTree(await categoryRepo.listAll(false)),
        env.CACHE_TTL_CATEGORY
      );
      return { tree: tree ?? [] };
    }

    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const skip = (page - 1) * perPage;
    const { rows, total } = await categoryRepo.listPaged(includeInactive, skip, perPage);
    const counts = await categoryRepo.vendorCountsByCategory();
    const rowsWithCounts = rows.map((row) => ({
      ...row,
      vendor_count: counts.get(row.id) ?? 0,
    }));
    return { rows: rowsWithCounts, total, page, perPage };
  },

  async getById(id: string): Promise<categoryRepo.CategoryRow> {
    const category = await cacheService.remember<categoryRepo.CategoryRow>(
      "category",
      `detail:${id}`,
      async () => {
        const found = await categoryRepo.findById(id);
        if (!found) {
          throw new ApiError(HttpStatus.NOT_FOUND, "Category not found.", { code: "NOT_FOUND" });
        }
        return found;
      }
    );
    return category as categoryRepo.CategoryRow;
  },

  async getBySlug(slug: string): Promise<categoryRepo.CategoryRow> {
    const category = await cacheService.remember<categoryRepo.CategoryRow>(
      "category",
      `slug:${slug}`,
      async () => {
        const found = await categoryRepo.findBySlug(slug);
        if (!found || !found.is_active) {
          throw new ApiError(HttpStatus.NOT_FOUND, "Category not found.", { code: "NOT_FOUND" });
        }
        return found;
      }
    );
    return category as categoryRepo.CategoryRow;
  },

  async create(input: CreateCategoryBody, req: Request): Promise<categoryRepo.CategoryRow> {
    if (input.parent_id) {
      const parent = await categoryRepo.existsById(input.parent_id);
      if (!parent) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "Parent category does not exist.", {
          code: "INVALID_PARENT",
        });
      }
    }

    const existing = await categoryRepo.listSlugs();
    const slug = uniqueSlug(input.name, existing);

    const category = await categoryRepo.createCategory({
      name: input.name.trim(),
      slug,
      parent_id: input.parent_id ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      image_url: input.image_url ?? null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      is_featured: input.is_featured ?? false,
    });

    await cacheService.invalidateNamespace("category");

    await auditService.record(
      { userId: req.user?.id, action: AUDIT_ACTIONS.CATEGORY_CREATED, entityType: "category", entityId: category.id, newValues: { name: category.name, slug } },
      req
    );

    return category;
  },

  async update(id: string, input: UpdateCategoryBody, req: Request): Promise<categoryRepo.CategoryRow> {
    const existing = await categoryRepo.findById(id);
    if (!existing) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Category not found.", { code: "NOT_FOUND" });
    }

    if (input.parent_id !== undefined && input.parent_id !== null && input.parent_id === id) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "A category cannot be its own parent.", {
        code: "INVALID_PARENT",
      });
    }

    if (input.parent_id) {
      const parent = await categoryRepo.existsById(input.parent_id);
      if (!parent) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "Parent category does not exist.", {
          code: "INVALID_PARENT",
        });
      }
    }

    if (input.name && input.name.trim() !== existing.name) {
      const existingSlugs = await categoryRepo.listSlugs(id);
      const slug = uniqueSlug(input.name.trim(), existingSlugs);
      if (slug !== existing.slug) {
        const taken = await categoryRepo.findBySlug(slug);
        if (taken && taken.id !== id) {
          throw new ConflictError("A category with this name already exists.");
        }
      }
      await categoryRepo.updateCategory(id, { name: input.name.trim(), slug });
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.parent_id !== undefined) data.parent_id = input.parent_id;
    if (input.icon !== undefined) data.icon = input.icon || null;
    if (input.color !== undefined) data.color = input.color || null;
    if (input.image_url !== undefined) data.image_url = input.image_url || null;
    if (input.sort_order !== undefined) data.sort_order = input.sort_order;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (input.is_featured !== undefined) data.is_featured = input.is_featured;

    const category = await categoryRepo.updateCategory(id, data as never);

    await cacheService.invalidateNamespace("category");

    await auditService.record(
      { userId: req.user?.id, action: AUDIT_ACTIONS.CATEGORY_UPDATED, entityType: "category", entityId: id, newValues: data },
      req
    );

    return category;
  },

  async remove(id: string, req: Request): Promise<void> {
    const existing = await categoryRepo.findById(id);
    if (!existing) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Category not found.", { code: "NOT_FOUND" });
    }
    await categoryRepo.softDelete(id);
    await cacheService.invalidateNamespace("category");
    await auditService.record(
      { userId: req.user?.id, action: AUDIT_ACTIONS.CATEGORY_DELETED, entityType: "category", entityId: id },
      req
    );
  },
};
