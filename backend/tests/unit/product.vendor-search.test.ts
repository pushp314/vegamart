import { productService } from "../../src/services/product.service";
import * as productRepo from "../../src/repositories/product.repository";

jest.mock("../../src/repositories/product.repository");
jest.mock("../../src/repositories/category.repository");

describe("Vendor-Specific Product Search", () => {
  const mockVendorIdA = "11111111-1111-1111-1111-111111111111";
  const mockVendorIdB = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes q and vendorId filter correctly to productRepo.listProducts", async () => {
    (productRepo.listProducts as jest.Mock).mockResolvedValue({
      rows: [
        {
          id: "prod-1",
          vendor_id: mockVendorIdA,
          name: "Basmati Rice (चावल)",
          price: 120,
        },
      ],
      total: 1,
    });

    const result = await productService.list({
      vendor_id: mockVendorIdA,
      q: "चावल",
      page: 1,
      per_page: 20,
    });

    expect(productRepo.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorId: mockVendorIdA,
        q: "चावल",
      }),
      0,
      20,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.vendor_id).toBe(mockVendorIdA);
    expect(result.rows[0]?.name).toContain("चावल");
  });

  it("never returns products from other vendors when scoped to vendor_id", async () => {
    (productRepo.listProducts as jest.Mock).mockImplementation(async (filter) => {
      const allDbProducts = [
        { id: "prod-1", vendor_id: mockVendorIdA, name: "Tomato" },
        { id: "prod-2", vendor_id: mockVendorIdB, name: "Tomato Fresh" },
      ];
      const matched = allDbProducts.filter(
        (p) => (!filter.vendorId || p.vendor_id === filter.vendorId) &&
               (!filter.q || p.name.toLowerCase().includes(filter.q.toLowerCase()))
      );
      return { rows: matched, total: matched.length };
    });

    const resA = await productService.list({
      vendor_id: mockVendorIdA,
      q: "Tomato",
      page: 1,
      per_page: 20,
    });

    expect(resA.rows.every((p: any) => p.vendor_id === mockVendorIdA)).toBe(true);
    expect(resA.rows).toHaveLength(1);
    expect(resA.rows[0]?.id).toBe("prod-1");

    const resB = await productService.list({
      vendor_id: mockVendorIdB,
      q: "Tomato",
      page: 1,
      per_page: 20,
    });

    expect(resB.rows.every((p: any) => p.vendor_id === mockVendorIdB)).toBe(true);
    expect(resB.rows).toHaveLength(1);
    expect(resB.rows[0]?.id).toBe("prod-2");
  });
});
