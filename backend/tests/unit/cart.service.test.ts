import { cartService } from "../../src/services/cart.service";

jest.mock("../../src/repositories/cart.repository", () => ({
  getOrCreate: jest.fn(),
  findByUserId: jest.fn(),
  addItem: jest.fn(),
  setItemQuantity: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

jest.mock("../../src/repositories/inventory.repository", () => ({
  findByProductId: jest.fn(),
}));

jest.mock("../../src/repositories/product.repository", () => ({
  findById: jest.fn(),
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

import * as cartRepo from "../../src/repositories/cart.repository";
import * as inventoryRepo from "../../src/repositories/inventory.repository";
import * as productRepo from "../../src/repositories/product.repository";

const repo = cartRepo as jest.Mocked<typeof cartRepo>;
const invRepo = inventoryRepo as jest.Mocked<typeof inventoryRepo>;
const prodRepo = productRepo as jest.Mocked<typeof productRepo>;

const mockReq = { user: { id: "u1" } } as any;

function makeDecimal(value: number) {
  return { toNumber: () => value } as any;
}

function makeCart(overrides: Partial<cartRepo.CartRow> = {}): cartRepo.CartRow {
  return {
    id: "cart-1",
    user_id: "u1",
    created_at: new Date(),
    updated_at: new Date(),
    items: [
      {
        id: "ci-1",
        product_id: "p1",
        quantity: 2,
        price_snapshot: makeDecimal(50),
        created_at: new Date(),
        updated_at: new Date(),
        product: {
          id: "p1",
          name: "Tomato",
          slug: "tomato",
          unit: "kg",
          price: makeDecimal(50),
          mrp: makeDecimal(60),
          is_active: true,
          is_available: true,
          stock: 10,
          vendor_id: "v1",
          category_id: "c1",
          images: [],
        },
      },
    ],
    ...overrides,
  };
}

describe("cart service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("gets or creates the user's cart", async () => {
    repo.getOrCreate.mockResolvedValue(makeCart());
    const cart = await cartService.getMyCart("u1");
    expect(cart.id).toBe("cart-1");
    expect(repo.getOrCreate).toHaveBeenCalledWith("u1");
  });

  it("adds an item and checks stock against available inventory", async () => {
    prodRepo.findById.mockResolvedValue({
      id: "p1",
      vendor_id: "v1",
      category_id: "c1",
      subcategory_id: null,
      name: "Tomato",
      slug: "tomato",
      description: null,
      price: makeDecimal(50),
      mrp: makeDecimal(60),
      unit: "kg",
      tag: null,
      is_active: true,
      is_featured: false,
      is_vegetarian: true,
      rating: 0,
      review_count: 0,
      stock: 10,
      is_available: true,
      created_at: new Date(),
      updated_at: new Date(),
      images: [],
      vendor: { is_open: true, status: "APPROVED" },
    } as any);
    invRepo.findByProductId.mockResolvedValue({ quantity: 10, reserved: 2 } as any);
    repo.getOrCreate.mockResolvedValue(makeCart());
    repo.addItem.mockResolvedValue(makeCart());

    await cartService.addItem("u1", { product_id: "p1", quantity: 2 }, mockReq);
    expect(repo.addItem).toHaveBeenCalledWith("cart-1", "p1", 2, expect.anything());
  });

  it("rejects when quantity exceeds the available stock", async () => {
    prodRepo.findById.mockResolvedValue({
      id: "p1",
      is_active: true,
      is_available: true,
      stock: 3,
      price: makeDecimal(50),
      vendor: { is_open: true, status: "APPROVED" },
    } as any);
    invRepo.findByProductId.mockResolvedValue({ quantity: 3, reserved: 0 } as any);
    repo.getOrCreate.mockResolvedValue(makeCart());

    await expect(cartService.addItem("u1", { product_id: "p1", quantity: 5 }, mockReq)).rejects.toMatchObject({
      statusCode: 422,
      code: "INSUFFICIENT_STOCK",
    });
  });

  it("rejects when the product is unavailable", async () => {
    prodRepo.findById.mockResolvedValue({ id: "p1", is_active: true, is_available: false } as any);

    await expect(cartService.addItem("u1", { product_id: "p1", quantity: 1 }, mockReq)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("updates an item quantity", async () => {
    repo.getOrCreate.mockResolvedValue(makeCart());
    invRepo.findByProductId.mockResolvedValue({ quantity: 20, reserved: 0 } as any);
    repo.setItemQuantity.mockResolvedValue(makeCart());

    await cartService.updateItem("u1", "ci-1", { quantity: 3 }, mockReq);
    expect(repo.setItemQuantity).toHaveBeenCalledWith("cart-1", "ci-1", 3);
  });

  it("throws 404 when updating a missing cart item", async () => {
    repo.getOrCreate.mockResolvedValue(makeCart({ items: [] }));
    await expect(cartService.updateItem("u1", "missing", { quantity: 1 }, mockReq)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("removes an item", async () => {
    repo.getOrCreate.mockResolvedValue(makeCart());
    repo.removeItem.mockResolvedValue(true);
    repo.findByUserId.mockResolvedValue(makeCart({ items: [] }));

    const cart = await cartService.removeItem("u1", "ci-1", mockReq);
    expect(repo.removeItem).toHaveBeenCalledWith("cart-1", "ci-1");
    expect(cart.items).toHaveLength(0);
  });

  it("throws 404 when removing a missing item", async () => {
    repo.getOrCreate.mockResolvedValue(makeCart());
    repo.removeItem.mockResolvedValue(false);
    await expect(cartService.removeItem("u1", "missing", mockReq)).rejects.toMatchObject({ statusCode: 404 });
  });
});
