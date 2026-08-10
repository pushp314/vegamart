import { vendorService } from "../../src/services/vendor.service";

jest.mock("../../src/repositories/vendor.repository", () => ({
  findByUserId: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  listSlugs: jest.fn(),
  listVendors: jest.fn(),
  listWithinBoundingBox: jest.fn(),
  createVendor: jest.fn(),
  updateVendor: jest.fn(),
  countApproved: jest.fn(),
  softDelete: jest.fn(),
}));

jest.mock("../../src/repositories/user.repository", () => ({
  findById: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/services/notification.service", () => ({
  notificationService: { vendor: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/services/email.service", () => ({
  emailService: {
    sendVendorApproved: jest.fn().mockResolvedValue(true),
    sendVendorRejected: jest.fn().mockResolvedValue(true),
  },
}));

import * as vendorRepo from "../../src/repositories/vendor.repository";
import * as userRepo from "../../src/repositories/user.repository";
import { notificationService } from "../../src/services/notification.service";
import { emailService } from "../../src/services/email.service";

const repo = vendorRepo as jest.Mocked<typeof vendorRepo>;
const mockUserRepo = userRepo as jest.Mocked<typeof userRepo>;

const mockReq = { user: { id: "admin-1" } } as any;

function makeVendor(overrides: Partial<vendorRepo.VendorRow> = {}): vendorRepo.VendorRow {
  return {
    id: "v1",
    user_id: "u1",
    business_name: "Sharma Store",
    slug: "sharma-store",
    description: null,
    category: null,
    tags: null,
    logo_url: null,
    banner_url: null,
    address: "12 Main Rd",
    landmark: null,
    city: "Delhi",
    state: "DL",
    country: "India",
    pincode: "110001",
    latitude: 28.6,
    longitude: 77.2,
    delivery_radius_km: 5,
    business_hours: null,
    min_order: { toNumber: () => 0, toFixed: (n: number) => (0).toFixed(n) } as any,
    delivery_fee: { toNumber: () => 30, toFixed: (n: number) => (30).toFixed(n) } as any,
    free_delivery_min_order: null,
    provides_delivery: false,
    rating: 4,
    review_count: 2,
    is_open: true,
    is_verified: true,
    is_sponsored: false,
    sponsored_until: null,
    status: "APPROVED",
    owner_name: null,
    phone: null,
    rejection_reason: null,
    commission_rate: { toNumber: () => 5, toFixed: (n: number) => (5).toFixed(n) } as any,
    membership_tier: "basic",
    membership_plan_id: null,
    membership_expires_at: null,
    membership_plan: null,
    available_from: null,
    available_to: null,
    roaming: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("vendor service — location module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.findByUserId.mockResolvedValue(makeVendor());
  });

  it("updates location details and audits the change", async () => {
    repo.updateVendor.mockResolvedValue(makeVendor({ latitude: 28.7, landmark: "Near Metro" }));

    const updated = await vendorService.updateLocation("u1", { latitude: 28.7, landmark: "Near Metro" }, mockReq);

    expect(repo.updateVendor).toHaveBeenCalledWith("v1", expect.objectContaining({ latitude: 28.7, landmark: "Near Metro" }));
    expect(updated.latitude).toBe(28.7);
    expect(updated.landmark).toBe("Near Metro");
  });

  it("throws when no location fields are provided", async () => {
    await expect(vendorService.updateLocation("u1", {}, mockReq)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("returns only the location payload for the authenticated vendor", async () => {
    const location = await vendorService.getMyLocation("u1");
    expect(location).toMatchObject({
      latitude: 28.6,
      longitude: 77.2,
      address: "12 Main Rd",
      city: "Delhi",
      country: "India",
      pincode: "110001",
      delivery_radius_km: 5,
    });
    expect(location).not.toHaveProperty("business_name");
  });

  it("returns location for a public vendor by id", async () => {
    repo.findById.mockResolvedValue(makeVendor());
    const location = await vendorService.getLocationById("v1");
    expect(location.country).toBe("India");
    expect(repo.findById).toHaveBeenCalledWith("v1");
  });

  it("paginates nearby vendor results", async () => {
    const vendors = Array.from({ length: 5 }, (_, i) =>
      makeVendor({ id: `v${i}`, latitude: 28.6 + i * 0.01, longitude: 77.2 })
    );
    repo.listWithinBoundingBox.mockResolvedValue(vendors);

    const result = await vendorService.nearby(28.6, 77.2, 5, { page: 1, perPage: 2 });
    expect(result.vendors).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
  });

  it("sends approval notification and email on review approve", async () => {
    const vendor = makeVendor();
    repo.findById.mockResolvedValue(vendor);
    repo.updateVendor.mockResolvedValue({ ...vendor, status: "APPROVED" });
    mockUserRepo.findById.mockResolvedValue({ email: "vendor@example.com", name: "Vendor" } as any);

    await vendorService.review("admin-1", "v1", "approve", null, mockReq);

    expect(notificationService.vendor).toHaveBeenCalledWith(
      "u1",
      "Vendor application approved",
      expect.stringContaining("approved"),
      expect.objectContaining({ status: "approved" })
    );
    expect(emailService.sendVendorApproved).toHaveBeenCalledWith("vendor@example.com", {
      name: "Vendor",
      businessName: "Sharma Store",
    });
  });

  it("sends rejection notification and email with the reason", async () => {
    const vendor = makeVendor();
    repo.findById.mockResolvedValue(vendor);
    repo.updateVendor.mockResolvedValue({ ...vendor, status: "REJECTED" });
    mockUserRepo.findById.mockResolvedValue({ email: "vendor@example.com", name: "Vendor" } as any);

    await vendorService.review("admin-1", "v1", "reject", "Invalid documents", mockReq);

    expect(emailService.sendVendorRejected).toHaveBeenCalledWith("vendor@example.com", {
      name: "Vendor",
      businessName: "Sharma Store",
      reason: "Invalid documents",
    });
    expect(notificationService.vendor).toHaveBeenCalledWith(
      "u1",
      "Vendor application rejected",
      expect.stringContaining("Invalid documents"),
      expect.objectContaining({ status: "rejected" })
    );
  });
});
