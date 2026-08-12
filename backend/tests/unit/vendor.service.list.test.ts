import { vendorService } from "../../src/services/vendor.service";

jest.mock("../../src/repositories/vendor.repository", () => ({
  listVendors: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findByUserId: jest.fn(),
  listSlugs: jest.fn(),
  createVendor: jest.fn(),
  updateVendor: jest.fn(),
  restore: jest.fn(),
  getVendorStats: jest.fn(),
  getVendorDetail: jest.fn(),
  listWithinBoundingBox: jest.fn(),
  listVendorsAdmin: jest.fn(),
}));

jest.mock("../../src/database/cache", () => ({
  cacheService: {
    remember: jest.fn((_namespace: string, _key: string, load: () => Promise<unknown>) => load()),
    invalidateNamespace: jest.fn(),
  },
}));

jest.mock("../../src/utils/slug", () => ({
  uniqueSlug: jest.fn((name: string, existing: Set<string>) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let candidate = slug;
    let i = 2;
    while (existing.has(candidate)) {
      candidate = `${slug}-${i++}`;
    }
    return candidate;
  }),
}));

import * as vendorRepo from "../../src/repositories/vendor.repository";

const repo = vendorRepo as jest.Mocked<typeof vendorRepo>;

function makeVendor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "v1",
    user_id: "u1",
    business_name: "Fresh Harvest Mart",
    slug: "fresh-harvest-mart",
    category: "Fruits & Vegetables",
    tags: null,
    description: null,
    logo_url: null,
    banner_url: null,
    landmark: null,
    business_hours: null,
    address: "Shop 12",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    pincode: "400058",
    latitude: null,
    longitude: null,
    delivery_radius_km: 5,
    min_order: "0",
    delivery_fee: "10",
    free_delivery_min_order: null,
    provides_delivery: false,
    rating: 4.6,
    review_count: 12,
    is_open: true,
    is_verified: true,
    is_sponsored: false,
    sponsored_until: null,
    sponsored_priority: 0,
    status: "APPROVED",
    owner_name: null,
    phone: null,
    rejection_reason: null,
    available_from: null,
    available_to: null,
    roaming: false,
    commission_rate: "5",
    membership_tier: "basic",
    membership_plan_id: null,
    membership_expires_at: null,
    membership_plan: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("vendor service list by category", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes category_id through to the repository", async () => {
    repo.listVendors.mockResolvedValue({
      rows: [makeVendor()] as unknown as vendorRepo.VendorRow[],
      total: 1,
    });

    const result = await vendorService.list({
      page: 1,
      per_page: 20,
      category_id: "cat-abc",
    });

    expect(repo.listVendors).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: "cat-abc" }),
      expect.any(Number),
      expect.any(Number)
    );
    expect(result.total).toBe(1);
  });

  it("returns vendors whose products belong to the category", async () => {
    repo.listVendors.mockResolvedValue({
      rows: [makeVendor({ id: "v1" }), makeVendor({ id: "v2" })] as unknown as vendorRepo.VendorRow[],
      total: 2,
    });

    const result = await vendorService.list({
      page: 1,
      per_page: 50,
      category_id: "cat-dairy",
    });

    expect(result.rows).toHaveLength(2);
    expect(repo.listVendors).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: "cat-dairy" }),
      0,
      50
    );
  });

  it("does not send category_id when absent", async () => {
    repo.listVendors.mockResolvedValue({ rows: [], total: 0 });

    await vendorService.list({ page: 1, per_page: 20 });

    expect(repo.listVendors).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: undefined }),
      expect.any(Number),
      expect.any(Number)
    );
  });
});
