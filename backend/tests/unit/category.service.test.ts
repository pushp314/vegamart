import { categoryService } from "../../src/services/category.service";

jest.mock("../../src/repositories/category.repository", () => ({
  existsById: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  listAll: jest.fn(),
  listPaged: jest.fn(),
  vendorCountsByCategory: jest.fn(),
  listSlugs: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  softDelete: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

import * as categoryRepo from "../../src/repositories/category.repository";

const repo = categoryRepo as jest.Mocked<typeof categoryRepo>;

const mockReq = { user: { id: "u1" } } as any;

function makeCategoryRow(overrides: Partial<categoryRepo.CategoryRow> = {}) {
  return {
    id: "cat-1",
    parent_id: null,
    name: "Vegetables",
    slug: "vegetables",
    icon: null,
    color: null,
    image_url: null,
    sort_order: 0,
    is_active: true,
    is_featured: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("category service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a category with a unique slug", async () => {
    repo.existsById.mockResolvedValue(false);
    repo.listSlugs.mockResolvedValue(new Set(["vegetables", "vegetables-2"]));
    repo.createCategory.mockResolvedValue(makeCategoryRow({ slug: "vegetables-3" }));

    const created = await categoryService.create({ name: "Vegetables" }, mockReq);

    expect(created.slug).toBe("vegetables-3");
    expect(repo.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Vegetables", slug: "vegetables-3" })
    );
  });

  it("rejects a non-existent parent category", async () => {
    repo.existsById.mockResolvedValue(false);
    await expect(
      categoryService.create({ name: "Leafy", parent_id: "missing" }, mockReq)
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_PARENT" });
  });

  it("throws 404 when updating a missing category", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(categoryService.update("missing", { name: "X" }, mockReq)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("prevents a category from being its own parent", async () => {
    repo.findById.mockResolvedValue(makeCategoryRow());
    await expect(
      categoryService.update("cat-1", { parent_id: "cat-1" }, mockReq)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("soft-deletes an existing category", async () => {
    repo.findById.mockResolvedValue(makeCategoryRow());
    repo.softDelete.mockResolvedValue(undefined);
    await categoryService.remove("cat-1", mockReq);
    expect(repo.softDelete).toHaveBeenCalledWith("cat-1");
  });

  it("throws 404 when deleting a missing category", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(categoryService.remove("missing", mockReq)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("builds a category tree from flat rows", async () => {
    repo.listAll.mockResolvedValue([
      makeCategoryRow({ id: "parent", slug: "groceries", name: "Groceries" }),
      makeCategoryRow({ id: "child", parent_id: "parent", slug: "leafy", name: "Leafy" }),
    ]);

    const result = await categoryService.list({ tree: "true" });
    expect(result).toHaveProperty("tree");
    const tree = (result as { tree: unknown[] }).tree;
    expect(tree).toHaveLength(1);
    expect((tree[0] as { children: unknown[] }).children).toHaveLength(1);
  });

  it("includes per-category vendor counts in the flat list", async () => {
    repo.listPaged.mockResolvedValue({
      rows: [
        makeCategoryRow({ id: "cat-1", slug: "vegetables" }),
        makeCategoryRow({ id: "cat-2", slug: "dairy" }),
      ],
      total: 2,
    });
    repo.vendorCountsByCategory.mockResolvedValue(
      new Map<string, number>([
        ["cat-1", 3],
        ["cat-2", 1],
      ])
    );

    const result = await categoryService.list({});
    const rows = (result as { rows: Array<{ id: string; vendor_count: number }> }).rows;
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === "cat-1")?.vendor_count).toBe(3);
    expect(rows.find((r) => r.id === "cat-2")?.vendor_count).toBe(1);
  });
});
