import { productService } from "../../src/services/product.service";

jest.mock("../../src/repositories/product.repository", () => ({
  listProducts: jest.fn(),
  listByVendor: jest.fn(),
}));

jest.mock("../../src/services/vendor.service", () => ({
  vendorService: {
    getMyVendor: jest.fn().mockImplementation((userId: string) => Promise.resolve({ id: `vendor-${userId}` })),
  },
}));

jest.mock("../../src/database/cache", () => ({
  cacheService: {
    remember: jest.fn().mockImplementation((_ns, _key, load) => load()),
  },
}));

import * as productRepo from "../../src/repositories/product.repository";

const repo = productRepo as jest.Mocked<typeof productRepo>;

function generateProducts(count: number, vendorId: string) {
  return Array.from({ length: count }, (_, i) => ({
    id: `prod-${vendorId}-${i + 1}`,
    vendor_id: vendorId,
    category_id: "cat-1",
    subcategory_id: null,
    name: `Product ${i + 1}`,
    slug: `product-${i + 1}`,
    description: null,
    price: 100,
    mrp: 120,
    unit: "1 pc",
    tag: null,
    is_active: true,
    is_featured: false,
    is_vegetarian: true,
    rating: 4.8,
    review_count: 5,
    stock: 50,
    is_available: true,
    created_at: new Date(),
    updated_at: new Date(),
    images: [],
  }));
}

describe("Vendor Catalog Pagination & Product Limits", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const testCounts = [1, 20, 21, 50, 100, 200];

  testCounts.forEach((count) => {
    it(`allows vendor to manage all ${count} products via listMyProducts`, async () => {
      const userId = `user-${count}`;
      const vendorId = `vendor-${userId}`;
      const allProds = generateProducts(count, vendorId);

      repo.listByVendor.mockImplementation((vid: string, _inc: boolean, _q: any, skip: number, take: number) => {
        expect(vid).toBe(vendorId);
        const sliced = allProds.slice(skip, skip + take);
        return Promise.resolve({ rows: sliced as any, total: count });
      });

      // Page 1 with per_page = 100
      const page1Res = await productService.listMyProducts(userId, { per_page: 100, page: 1, include_inactive: "true" });
      const fetchedPage1 = page1Res.rows;

      if (count <= 100) {
        expect(fetchedPage1.length).toBe(count);
        expect(page1Res.total).toBe(count);
      } else {
        expect(fetchedPage1.length).toBe(100);
        expect(page1Res.total).toBe(count);

        // Page 2 for count > 100
        const page2Res = await productService.listMyProducts(userId, { per_page: 100, page: 2, include_inactive: "true" });
        const fetchedPage2 = page2Res.rows;
        expect(fetchedPage2.length).toBe(count - 100);

        const combined = [...fetchedPage1, ...fetchedPage2];
        expect(combined.length).toBe(count);
        const uniqueIds = new Set(combined.map((p) => p.id));
        expect(uniqueIds.size).toBe(count);
      }
    });
  });
});
