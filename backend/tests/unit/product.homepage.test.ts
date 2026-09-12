import { listProductsForHomepage } from "../../src/repositories/product.repository";

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    vendorProfile: {
      findMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from "../../src/database/prisma";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function makeVendorRow(id: string, name: string, isSponsored = false) {
  return {
    id,
    business_name: name,
    is_sponsored: isSponsored,
  };
}

function makeProductRow(id: string, vendorId: string, name: string) {
  return {
    id,
    vendor_id: vendorId,
    category_id: "cat-1",
    subcategory_id: null,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    description: null,
    price: 50,
    mrp: 60,
    unit: "1 kg",
    tag: null,
    is_active: true,
    is_featured: false,
    is_vegetarian: true,
    rating: 4.5,
    review_count: 10,
    stock: 100,
    is_available: true,
    created_at: new Date(),
    updated_at: new Date(),
    vendor: { id: vendorId, business_name: `Store ${vendorId}`, is_sponsored: false },
    category: { id: "cat-1", name: "Produce", slug: "produce" },
    images: [],
  };
}

describe("listProductsForHomepage — Multi-Store Aggregation & Diversity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("1. Handles one eligible store", async () => {
    (mockPrisma.vendorProfile.findMany as jest.Mock).mockResolvedValue([
      makeVendorRow("v1", "Store 1"),
    ]);
    (mockPrisma.product.findMany as jest.Mock).mockImplementation((args: any) => {
      if (args.where.vendor_id === "v1") {
        return Promise.resolve([makeProductRow("p1", "v1", "Apple"), makeProductRow("p2", "v1", "Banana")]);
      }
      return Promise.resolve([]);
    });

    const res = await listProductsForHomepage({ perPage: 10, productsPerVendor: 10, vendorIsOpen: false });
    expect(res.rows.length).toBe(2);
    expect(res.rows[0]!.vendor_id).toBe("v1");
  });

  it("2. Interleaves products across two eligible stores", async () => {
    (mockPrisma.vendorProfile.findMany as jest.Mock).mockResolvedValue([
      makeVendorRow("v1", "Store 1"),
      makeVendorRow("v2", "Store 2"),
    ]);
    (mockPrisma.product.findMany as jest.Mock).mockImplementation((args: any) => {
      if (args.where.vendor_id === "v1") {
        return Promise.resolve([makeProductRow("p1", "v1", "Apple 1"), makeProductRow("p2", "v1", "Apple 2")]);
      }
      if (args.where.vendor_id === "v2") {
        return Promise.resolve([makeProductRow("p3", "v2", "Orange 1"), makeProductRow("p4", "v2", "Orange 2")]);
      }
      return Promise.resolve([]);
    });

    const res = await listProductsForHomepage({ perPage: 10, productsPerVendor: 10, vendorIsOpen: false });
    expect(res.rows.length).toBe(4);
    // Round-robin: v1, v2, v1, v2
    expect(res.rows[0]!.vendor_id).toBe("v1");
    expect(res.rows[1]!.vendor_id).toBe("v2");
    expect(res.rows[2]!.vendor_id).toBe("v1");
    expect(res.rows[3]!.vendor_id).toBe("v2");
  });

  it("3. Interleaves products across five eligible stores", async () => {
    const vendors = [1, 2, 3, 4, 5].map((i) => makeVendorRow(`v${i}`, `Store ${i}`));
    (mockPrisma.vendorProfile.findMany as jest.Mock).mockResolvedValue(vendors);
    (mockPrisma.product.findMany as jest.Mock).mockImplementation((args: any) => {
      const vid = args.where.vendor_id;
      return Promise.resolve([makeProductRow(`p-${vid}`, vid, `Item from ${vid}`)]);
    });

    const res = await listProductsForHomepage({ perPage: 10, productsPerVendor: 10, vendorIsOpen: false });
    expect(res.rows.length).toBe(5);
    const vendorIdsInResult = new Set(res.rows.map((r) => r.vendor_id));
    expect(vendorIdsInResult.size).toBe(5);
  });

  it("4. Supports multiple stores with products having identical names without collision", async () => {
    (mockPrisma.vendorProfile.findMany as jest.Mock).mockResolvedValue([
      makeVendorRow("v1", "Store 1"),
      makeVendorRow("v2", "Store 2"),
    ]);
    (mockPrisma.product.findMany as jest.Mock).mockImplementation((args: any) => {
      const vid = args.where.vendor_id;
      return Promise.resolve([makeProductRow(`p-${vid}`, vid, "Fresh Tomatoes")]);
    });

    const res = await listProductsForHomepage({ perPage: 10, productsPerVendor: 10, vendorIsOpen: false });
    expect(res.rows.length).toBe(2);
    expect(res.rows[0]!.name).toBe("Fresh Tomatoes");
    expect(res.rows[1]!.name).toBe("Fresh Tomatoes");
    expect(res.rows[0]!.vendor_id).not.toBe(res.rows[1]!.vendor_id);
  });

  it("5. Prevents one store with 200 products from monopolizing homepage when another store has 1 product", async () => {
    (mockPrisma.vendorProfile.findMany as jest.Mock).mockResolvedValue([
      makeVendorRow("v1", "Big Store"),
      makeVendorRow("v2", "Small Store"),
    ]);
    (mockPrisma.product.findMany as jest.Mock).mockImplementation((args: any) => {
      const vid = args.where.vendor_id;
      if (vid === "v1") {
        return Promise.resolve(Array.from({ length: 10 }, (_, i) => makeProductRow(`p1-${i}`, "v1", `Big Item ${i}`)));
      }
      return Promise.resolve([makeProductRow("p2-0", "v2", "Small Item 0")]);
    });

    // Small perPage slice (e.g. 5)
    const res = await listProductsForHomepage({ perPage: 5, productsPerVendor: 10, vendorIsOpen: false });
    expect(res.rows[0]!.vendor_id).toBe("v1");
    expect(res.rows[1]!.vendor_id).toBe("v2"); // Small store product appears in slot 1!
  });

  it("6. Filters out closed stores when vendorIsOpen=true is requested", async () => {
    (mockPrisma.vendorProfile.findMany as jest.Mock).mockImplementation((args: any) => {
      expect(args.where.is_open).toBe(true);
      return Promise.resolve([makeVendorRow("v-open", "Open Store")]);
    });
    (mockPrisma.product.findMany as jest.Mock).mockResolvedValue([
      makeProductRow("p-open", "v-open", "Open Store Product"),
    ]);

    const res = await listProductsForHomepage({ perPage: 10, productsPerVendor: 10, vendorIsOpen: true });
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]!.vendor_id).toBe("v-open");
  });

  it("7. Ensures only APPROVED vendors are fetched from DB query", async () => {
    (mockPrisma.vendorProfile.findMany as jest.Mock).mockImplementation((args: any) => {
      expect(args.where.status).toBe("APPROVED");
      expect(args.where.deleted_at).toBe(null);
      return Promise.resolve([]);
    });

    const res = await listProductsForHomepage({ perPage: 10, productsPerVendor: 10, vendorIsOpen: false });
    expect(res.rows).toEqual([]);
  });

  it("8. Skips vendors with empty catalogs gracefully", async () => {
    (mockPrisma.vendorProfile.findMany as jest.Mock).mockResolvedValue([
      makeVendorRow("v-empty1", "Empty Store 1"),
      makeVendorRow("v-active", "Active Store"),
      makeVendorRow("v-empty2", "Empty Store 2"),
    ]);
    (mockPrisma.product.findMany as jest.Mock).mockImplementation((args: any) => {
      if (args.where.vendor_id === "v-active") {
        return Promise.resolve([makeProductRow("p-act", "v-active", "Active Product")]);
      }
      return Promise.resolve([]);
    });

    const res = await listProductsForHomepage({ perPage: 10, productsPerVendor: 10, vendorIsOpen: false });
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]!.vendor_id).toBe("v-active");
  });
});
