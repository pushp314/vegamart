import { wishlistService } from "../../src/services/wishlist.service";

jest.mock("../../src/repositories/wishlist.repository", () => ({
  listByUser: jest.fn(),
  findByUserAndProduct: jest.fn(),
  add: jest.fn(),
  remove: jest.fn(),
}));

jest.mock("../../src/repositories/product.repository", () => ({
  findById: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

import * as wishlistRepo from "../../src/repositories/wishlist.repository";
import * as productRepo from "../../src/repositories/product.repository";

const repo = wishlistRepo as jest.Mocked<typeof wishlistRepo>;
const prodRepo = productRepo as jest.Mocked<typeof productRepo>;

const mockReq = { user: { id: "u1" } } as any;

describe("wishlist service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists the user's wishlist", async () => {
    repo.listByUser.mockResolvedValue([{ id: "w1", product_id: "p1", created_at: new Date(), product: {} } as any]);
    const items = await wishlistService.list("u1");
    expect(items).toHaveLength(1);
  });

  it("adds a product to the wishlist", async () => {
    prodRepo.findById.mockResolvedValue({ id: "p1", is_active: true } as any);
    repo.findByUserAndProduct.mockResolvedValue(null);
    repo.add.mockResolvedValue({ id: "w1", product_id: "p1", created_at: new Date(), product: {} } as any);

    const item = await wishlistService.add("u1", "p1", mockReq);
    expect(repo.add).toHaveBeenCalledWith("u1", "p1");
    expect(item.product_id).toBe("p1");
  });

  it("throws 404 when the product does not exist", async () => {
    prodRepo.findById.mockResolvedValue(null);
    await expect(wishlistService.add("u1", "p1", mockReq)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 409 when already in the wishlist", async () => {
    prodRepo.findById.mockResolvedValue({ id: "p1", is_active: true } as any);
    repo.findByUserAndProduct.mockResolvedValue({ id: "w1" } as any);
    await expect(wishlistService.add("u1", "p1", mockReq)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("removes a wishlist item", async () => {
    repo.remove.mockResolvedValue(true);
    await wishlistService.remove("u1", "p1", mockReq);
    expect(repo.remove).toHaveBeenCalledWith("u1", "p1");
  });

  it("throws 404 when removing a missing item", async () => {
    repo.remove.mockResolvedValue(false);
    await expect(wishlistService.remove("u1", "p1", mockReq)).rejects.toMatchObject({ statusCode: 404 });
  });
});
