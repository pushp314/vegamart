import { productService } from "../../src/services/product.service";

jest.mock("../../src/repositories/product.repository", () => ({
  findById: jest.fn(),
  listSlugs: jest.fn(),
  countForVendor: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  softDelete: jest.fn(),
  listProducts: jest.fn(),
  listProductsAdmin: jest.fn(),
  listByVendor: jest.fn(),
  listByVendorIds: jest.fn(),
  addImage: jest.fn(),
  removeImage: jest.fn(),
  setPrimaryImage: jest.fn(),
  listImages: jest.fn(),
}));

jest.mock("../../src/repositories/category.repository", () => ({
  existsById: jest.fn(),
}));

jest.mock("../../src/services/vendor.service", () => ({
  vendorService: { getMyVendor: jest.fn() },
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/database/cache", () => ({
  cacheService: {
    remember: jest.fn().mockImplementation((_ns, _key, load) => load()),
    invalidateNamespace: jest.fn(),
    invalidateEntity: jest.fn(),
  },
}));

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    product: { update: jest.fn() },
    review: { findFirst: jest.fn(), aggregate: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import * as productRepo from "../../src/repositories/product.repository";
import { vendorService } from "../../src/services/vendor.service";
import * as categoryRepo from "../../src/repositories/category.repository";

const repo = productRepo as jest.Mocked<typeof productRepo>;
const catRepo = categoryRepo as jest.Mocked<typeof categoryRepo>;

const mockReq = { user: { id: "u1" } } as any;
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

function makeVendor(overrides: Partial<{ status: string; id: string }> = {}) {
  return { id: "vendor-1", user_id: "u1", status: "APPROVED", ...overrides } as any;
}

function makeProductRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "product-1",
    vendor_id: "vendor-1",
    category_id: VALID_UUID,
    subcategory_id: null,
    name: "Fresh Tomatoes",
    slug: "fresh-tomatoes",
    description: null,
    price: 40,
    mrp: 50,
    unit: "1 kg",
    tag: null,
    is_active: true,
    is_featured: false,
    is_vegetarian: null,
    rating: 0,
    review_count: 0,
    stock: 0,
    is_available: true,
    images: [],
    ...overrides,
  } as any;
}

describe("product service — vendor approval guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks product creation when the vendor is not approved", async () => {
    (vendorService.getMyVendor as jest.Mock).mockResolvedValue(makeVendor({ status: "PENDING" }));

    await expect(
      productService.create("u1", {
        name: "Fresh Tomatoes",
        category_id: VALID_UUID,
        price: 40,
        mrp: 50,
        unit: "1 kg",
      }, mockReq)
    ).rejects.toMatchObject({ code: "VENDOR_NOT_APPROVED" });

    expect(repo.createProduct).not.toHaveBeenCalled();
  });

  it("blocks product update when the vendor is not approved", async () => {
    repo.findById.mockResolvedValue(makeProductRow());
    (vendorService.getMyVendor as jest.Mock).mockResolvedValue(makeVendor({ status: "SUSPENDED" }));

    await expect(
      productService.update("u1", "product-1", { price: 45 }, mockReq)
    ).rejects.toMatchObject({ code: "VENDOR_NOT_APPROVED" });
  });

  it("creates a product for an approved vendor", async () => {
    (vendorService.getMyVendor as jest.Mock).mockResolvedValue(makeVendor({ status: "APPROVED" }));
    catRepo.existsById.mockResolvedValue(true);
    repo.listSlugs.mockResolvedValue(new Set());
    repo.countForVendor.mockResolvedValue(0);
    repo.createProduct.mockResolvedValue(makeProductRow());

    const created = await productService.create("u1", {
      name: "Fresh Tomatoes",
      category_id: VALID_UUID,
      price: 40,
      mrp: 50,
      unit: "1 kg",
    }, mockReq);

    expect(created.id).toBe("product-1");
    expect(repo.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor_id: "vendor-1",
        category_id: VALID_UUID,
        name: "Fresh Tomatoes",
        is_active: true,
        is_available: true,
      })
    );
  });

  it("rejects a non-existent category", async () => {
    (vendorService.getMyVendor as jest.Mock).mockResolvedValue(makeVendor({ status: "APPROVED" }));
    catRepo.existsById.mockResolvedValue(false);

    await expect(
      productService.create("u1", {
        name: "Fresh Tomatoes",
        category_id: VALID_UUID,
        price: 40,
        mrp: 50,
        unit: "1 kg",
      }, mockReq)
    ).rejects.toMatchObject({ code: "INVALID_CATEGORY" });
  });
});
