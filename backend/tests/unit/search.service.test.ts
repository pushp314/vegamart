import { searchService } from "../../src/services/search.service";

jest.mock("../../src/repositories/product.repository", () => ({
  listProducts: jest.fn(),
  listByVendorIds: jest.fn(),
}));
jest.mock("../../src/repositories/vendor.repository", () => ({
  listVendors: jest.fn(),
  listWithinBoundingBox: jest.fn(),
}));

import { listProducts, listByVendorIds } from "../../src/repositories/product.repository";
import { listVendors, listWithinBoundingBox } from "../../src/repositories/vendor.repository";

const mockedListProducts = listProducts as jest.Mock;
const mockedListVendors = listVendors as jest.Mock;
const mockedListByVendorIds = listByVendorIds as jest.Mock;
const mockedListWithinBoundingBox = listWithinBoundingBox as jest.Mock;

function makeProduct(overrides: Partial<{ name: string; description: string; tag: string }>) {
  return {
    id: "p",
    vendor_id: "v",
    category_id: "c",
    subcategory_id: null,
    name: overrides.name ?? "Product",
    slug: "product",
    description: overrides.description ?? null,
    price: { toFixed: () => "10.00" } as unknown as { toFixed(): string },
    mrp: { toFixed: () => "12.00" } as unknown as { toFixed(): string },
    unit: "1 kg",
    tag: overrides.tag ?? null,
    is_active: true,
    is_featured: false,
    is_vegetarian: null,
    rating: 4,
    review_count: 2,
    stock: 10,
    is_available: true,
    created_at: new Date(),
    updated_at: new Date(),
    images: [],
  };
}

function makeVendor(overrides: Partial<{ business_name: string; description: string; city: string }>) {
  return {
    id: "v",
    user_id: "u",
    business_name: overrides.business_name ?? "Vendor",
    slug: "vendor",
    description: overrides.description ?? null,
    category: null,
    tags: null,
    logo_url: null,
    banner_url: null,
    address: "addr",
    landmark: null,
    city: overrides.city ?? "Delhi",
    state: "DL",
    country: "India",
    pincode: "110001",
    latitude: 28.6,
    longitude: 77.2,
    delivery_radius_km: 5,
    business_hours: null,
    min_order: { toFixed: () => "0.00" } as unknown as { toFixed(): string },
    delivery_fee: { toFixed: () => "0.00" } as unknown as { toFixed(): string },
    rating: 4,
    review_count: 1,
    is_open: true,
    is_verified: true,
    status: "APPROVED",
    owner_name: null,
    phone: null,
    rejection_reason: null,
    available_from: null,
    available_to: null,
    roaming: false,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

describe("search service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ranks exact product name matches first", async () => {
    mockedListProducts.mockResolvedValue({
      rows: [
        makeProduct({ name: "Amul Butter 500g" }),
        makeProduct({ name: "Butter" }),
      ],
      total: 2,
    });

    const result = await searchService.search("butter", "products");
    expect(result.products[0]!.name).toBe("Butter");
    expect(mockedListProducts).toHaveBeenCalledWith({ q: "butter" }, 0, 20);
  });

  it("searches only vendors when type=vendors", async () => {
    mockedListVendors.mockResolvedValue({
      rows: [makeVendor({ business_name: "Sharma Dairy" })],
      total: 1,
    });

    const result = await searchService.search("dairy", "vendors");
    expect(result.vendors).toHaveLength(1);
    expect(result.products).toHaveLength(0);
    expect(mockedListProducts).not.toHaveBeenCalled();
  });

  it("returns combined results for type=all", async () => {
    mockedListProducts.mockResolvedValue({ rows: [makeProduct({ name: "Mango" })], total: 1 });
    mockedListVendors.mockResolvedValue({ rows: [makeVendor({ business_name: "Mango Cart" })], total: 1 });

    const result = await searchService.search("mango");
    expect(result.products).toHaveLength(1);
    expect(result.vendors).toHaveLength(1);
    expect(result.total).toBe(2);
  });

  it("autocomplete returns products and vendors with type labels", async () => {
    mockedListProducts.mockResolvedValue({ rows: [makeProduct({ name: "Onion" })], total: 1 });
    mockedListVendors.mockResolvedValue({ rows: [makeVendor({ business_name: "Onion Shop" })], total: 1 });

    const suggestions = await searchService.autocomplete("onion", 5);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((s) => s.type)).toEqual(["product", "vendor"]);
    expect(suggestions[0]).toMatchObject({ name: "Onion", type: "product" });
  });

  it("caps autocomplete results at the requested limit", async () => {
    mockedListProducts.mockResolvedValue({
      rows: Array.from({ length: 8 }, (_, i) => makeProduct({ name: `Item ${i}` })),
      total: 8,
    });
    mockedListVendors.mockResolvedValue({
      rows: Array.from({ length: 8 }, (_, i) => makeVendor({ business_name: `Vendor ${i}` })),
      total: 8,
    });

    const suggestions = await searchService.autocomplete("item", 3);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  describe("nearbyProducts", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("returns products from vendors that cover the location with distance and ETA", async () => {
      const vendor = makeVendor({ business_name: "Nearby Store" });
      mockedListWithinBoundingBox.mockResolvedValue([vendor]);
      mockedListByVendorIds.mockResolvedValue({
        rows: [makeProduct({ name: "Mango" })],
        total: 1,
      });

      const result = await searchService.nearbyProducts({ lat: 28.6, lng: 77.2, radiusKm: 5 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.product.name).toBe("Mango");
      expect(result.items[0]!.vendor.business_name).toBe("Nearby Store");
      expect(result.items[0]!.distance_km).toBeGreaterThanOrEqual(0);
      expect(result.items[0]!.estimated_delivery_minutes).toBeGreaterThanOrEqual(15);
      expect(mockedListByVendorIds).toHaveBeenCalledWith(
        [vendor.id],
        expect.objectContaining({ categoryId: undefined, q: undefined })
      );
    });

    it("excludes vendors whose delivery radius does not cover the point", async () => {
      const farVendor = makeVendor({ business_name: "Far Store" });
      farVendor.latitude = 12.9; // Bangalore vs query point Delhi (28.6, 77.2)
      farVendor.longitude = 77.6;
      farVendor.delivery_radius_km = 1;
      mockedListWithinBoundingBox.mockResolvedValue([farVendor]);
      mockedListByVendorIds.mockResolvedValue({ rows: [], total: 0 });

      const result = await searchService.nearbyProducts({ lat: 28.6, lng: 77.2, radiusKm: 5 });
      expect(result.items).toHaveLength(0);
      expect(mockedListByVendorIds).toHaveBeenCalledWith([], expect.any(Object));
    });

    it("passes through category and query filters", async () => {
      const vendor = makeVendor({ business_name: "Fruit Cart" });
      mockedListWithinBoundingBox.mockResolvedValue([vendor]);
      mockedListByVendorIds.mockResolvedValue({ rows: [], total: 0 });

      await searchService.nearbyProducts({
        lat: 28.6,
        lng: 77.2,
        categoryId: "cat-1",
        q: "mango",
      });
      expect(mockedListByVendorIds).toHaveBeenCalledWith(
        [vendor.id],
        expect.objectContaining({ categoryId: "cat-1", q: "mango" })
      );
    });
  });
});
