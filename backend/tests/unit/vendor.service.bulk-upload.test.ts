import { vendorService } from "../../src/services/vendor.service";
import { ApiError } from "../../src/utils/ApiError";

jest.mock("../../src/repositories/vendor.repository", () => ({
  findByUserId: jest.fn(),
}));

jest.mock("../../src/repositories/product.repository", () => ({
  listSlugs: jest.fn(),
}));

jest.mock("../../src/repositories/category.repository", () => ({
  existsById: jest.fn(),
  listAll: jest.fn(),
}));

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn({ product: { create: jest.fn() } })),
    product: { findMany: jest.fn() },
  },
}));

jest.mock("../../src/database/cache", () => ({
  cacheService: {
    invalidateNamespace: jest.fn(),
    remember: jest.fn((_n: string, _k: string, load: () => Promise<unknown>) => load()),
  },
}));

import prisma from "../../src/database/prisma";
import * as vendorRepo from "../../src/repositories/vendor.repository";
import * as productRepo from "../../src/repositories/product.repository";
import * as categoryRepo from "../../src/repositories/category.repository";
import { cacheService } from "../../src/database/cache";

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const tx = {
  product: { create: jest.fn().mockResolvedValue({ id: "p1" }) },
};

function mockVendor() {
  (vendorRepo.findByUserId as jest.Mock).mockResolvedValue({
    id: "v1",
    user_id: "u1",
    business_name: "Fresh Harvest Mart",
    slug: "fresh-harvest-mart",
    category: "Fruits & Vegetables",
    address: "Shop 12",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    pincode: "400058",
    status: "APPROVED",
  } as never);
}

function csv(header: string, ...rows: string[]): Buffer {
  return Buffer.from([header, ...rows].join("\n"), "utf8");
}

describe("vendorService.bulkUploadProducts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVendor();
    (productRepo.listSlugs as jest.Mock).mockResolvedValue(new Set<string>());
    (categoryRepo.existsById as jest.Mock).mockResolvedValue(true);
    (categoryRepo.listAll as jest.Mock).mockResolvedValue([
      { id: "cat-1", slug: "vegetables", name: "Vegetables" },
      { id: "cat-2", slug: "fruits", name: "Fruits" },
    ]);
    (cacheService.invalidateNamespace as jest.Mock).mockResolvedValue(undefined);
    (mockedPrisma.$transaction as jest.Mock).mockImplementation(
      (fn: (t: unknown) => Promise<unknown>) => fn(tx)
    );
  });

  it("imports all valid rows inside a single transaction", async () => {
    const result = await vendorService.bulkUploadProducts(
      "u1",
      csv("name,price,mrp,unit,category_id,stock", "Tomato,40,50,kg,cat-1,10", "Mango,120,150,kg,cat-2,5")
    );

    expect(result.count).toBe(2);
    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.product.create).toHaveBeenCalledTimes(2);
    expect(tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Tomato", price: 40, category_id: "cat-1", stock: 10 }),
      })
    );
    expect(cacheService.invalidateNamespace).toHaveBeenCalledWith("product");
  });

  it("assigns deterministic distinct slugs to duplicate names", async () => {
    const result = await vendorService.bulkUploadProducts(
      "u1",
      csv("name,price,unit,category_id", "Tomato,40,kg,cat-1", "Tomato,45,kg,cat-1", "Tomato,50,kg,cat-1")
    );

    expect(result.count).toBe(3);
    const calls = tx.product.create.mock.calls.map((c) => (c[0] as { data: { slug: string } }).data.slug);
    expect(calls).toEqual(["tomato", "tomato-2", "tomato-3"]);
  });

  it("does not collide with an existing product slug", async () => {
    (productRepo.listSlugs as jest.Mock).mockResolvedValue(new Set(["tomato"]));

    const result = await vendorService.bulkUploadProducts(
      "u1",
      csv("name,price,unit,category_id", "Tomato,40,kg,cat-1")
    );

    expect(result.count).toBe(1);
    const slug = (tx.product.create.mock.calls[0][0] as { data: { slug: string } }).data.slug;
    expect(slug).toBe("tomato-2");
  });

  it("rejects NaN prices and persists nothing", async () => {
    await expect(
      vendorService.bulkUploadProducts("u1", csv("name,price,unit,category_id", "Tomato,abc,kg,cat-1"))
    ).rejects.toMatchObject({
      code: "INVALID_ROWS",
      statusCode: 400,
    });

    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(tx.product.create).not.toHaveBeenCalled();
  });

  it("rejects negative prices and persists nothing", async () => {
    await expect(
      vendorService.bulkUploadProducts("u1", csv("name,price,unit,category_id", "Tomato,-5,kg,cat-1"))
    ).rejects.toMatchObject({ code: "INVALID_ROWS" });

    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects rows with an unknown category_id", async () => {
    (categoryRepo.listAll as jest.Mock).mockResolvedValue([]);

    await expect(
      vendorService.bulkUploadProducts("u1", csv("name,price,unit,category_id", "Tomato,40,kg,nope"))
    ).rejects.toMatchObject({ code: "INVALID_ROWS" });

    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects missing required fields with useful per-row errors", async () => {
    const error = (await vendorService
      .bulkUploadProducts("u1", csv("name,price,unit,category_id", ",40,kg,cat-1", "Tomato,,kg,cat-1"))
      .catch((e) => e)) as ApiError;

    expect(error.code).toBe("INVALID_ROWS");
    expect(error.message).toContain("No products were imported");
    expect(error.details?.errors).toContain('Row 2: "name" is required.');
    expect(error.details?.errors).toContain('Row 3: "price" must be a valid non-negative number.');
  });

  it("returns count 0 for an empty file", async () => {
    const result = await vendorService.bulkUploadProducts("u1", Buffer.from("name,price,unit,category_id\n", "utf8"));
    expect(result.count).toBe(0);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });
});
