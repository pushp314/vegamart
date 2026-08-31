import { cartService } from "../../src/services/cart.service";
import * as productRepo from "../../src/repositories/product.repository";
import * as inventoryRepo from "../../src/repositories/inventory.repository";
import * as cartRepo from "../../src/repositories/cart.repository";
import { settingsService } from "../../src/services/settings.service";
import { auditService } from "../../src/services/audit.service";
import { Prisma } from "@prisma/client";

jest.mock("../../src/repositories/product.repository");
jest.mock("../../src/repositories/inventory.repository");
jest.mock("../../src/repositories/cart.repository");
jest.mock("../../src/repositories/category.repository");
jest.mock("../../src/services/vendor.service", () => ({
  vendorService: { getMyVendor: jest.fn() },
}));
jest.mock("../../src/services/settings.service");
jest.mock("../../src/services/audit.service");

const mockReq = {} as any;

describe("Stock & Inventory Management Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (settingsService.getAllSettings as jest.Mock).mockResolvedValue({
      "platform.multi_store_checkout_enabled": true,
    });
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
  });

  const baseProduct = {
    id: "p1",
    vendor_id: "v1",
    category_id: "c1",
    subcategory_id: null,
    name: "Fresh Tomatoes",
    slug: "fresh-tomatoes",
    description: null,
    price: new Prisma.Decimal(40),
    mrp: new Prisma.Decimal(50),
    unit: "1 kg",
    variants: null,
    tag: null,
    is_active: true,
    is_featured: false,
    is_vegetarian: true,
    rating: 4.5,
    review_count: 10,
    stock: 1,
    total_stock: 1,
    is_available: true,
    created_at: new Date(),
    updated_at: new Date(),
    images: [],
    vendor: { id: "v1", business_name: "Fresh Farms", logo_url: null, status: "APPROVED", is_open: true },
  };

  const emptyCart = {
    id: "cart-1",
    user_id: "u1",
    created_at: new Date(),
    updated_at: new Date(),
    items: [],
  };

  test("Allows adding item to cart when product.stock is 1, even if inventory row is out of sync (quantity: 0)", async () => {
    (productRepo.findById as jest.Mock).mockResolvedValue({ ...baseProduct, stock: 1 });
    (cartRepo.getOrCreate as jest.Mock).mockResolvedValue(emptyCart);
    (inventoryRepo.findByProductId as jest.Mock).mockResolvedValue({
      id: "inv-1",
      product_id: "p1",
      quantity: 0, // Stale inventory quantity
      reserved: 0,
      low_stock_threshold: 5,
      location: null,
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    (cartRepo.addItem as jest.Mock).mockResolvedValue({
      ...emptyCart,
      items: [
        {
          id: "item-1",
          cart_id: "cart-1",
          product_id: "p1",
          quantity: 1,
          selected_unit: "1 kg",
          price_snapshot: new Prisma.Decimal(40),
          created_at: new Date(),
          updated_at: new Date(),
          product: baseProduct,
        },
      ],
    });

    const result = await cartService.addItem("u1", { product_id: "p1", quantity: 1 }, mockReq);
    expect(result.items).toHaveLength(1);
    expect(cartRepo.addItem).toHaveBeenCalledWith("cart-1", "p1", 1, expect.any(Prisma.Decimal), "1 kg");
  });

  test("Rejects adding to cart when product.stock is 0 with SOLD_OUT code", async () => {
    (productRepo.findById as jest.Mock).mockResolvedValue({ ...baseProduct, stock: 0, is_available: true });
    (cartRepo.getOrCreate as jest.Mock).mockResolvedValue(emptyCart);
    (inventoryRepo.findByProductId as jest.Mock).mockResolvedValue(null);

    await expect(
      cartService.addItem("u1", { product_id: "p1", quantity: 1 }, mockReq)
    ).rejects.toMatchObject({
      code: "SOLD_OUT",
      message: "Product is sold out.",
    });
  });

  test("Rejects adding to cart when requested quantity exceeds product.stock", async () => {
    (productRepo.findById as jest.Mock).mockResolvedValue({ ...baseProduct, stock: 1 });
    (cartRepo.getOrCreate as jest.Mock).mockResolvedValue(emptyCart);
    (inventoryRepo.findByProductId as jest.Mock).mockResolvedValue({
      id: "inv-1",
      product_id: "p1",
      quantity: 1,
      reserved: 0,
    });

    await expect(
      cartService.addItem("u1", { product_id: "p1", quantity: 2 }, mockReq)
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      message: "Insufficient stock for this product.",
    });
  });

  test("Allows updating item quantity up to available stock", async () => {
    const existingCart = {
      ...emptyCart,
      items: [
        {
          id: "item-1",
          cart_id: "cart-1",
          product_id: "p1",
          quantity: 1,
          selected_unit: "1 kg",
          price_snapshot: new Prisma.Decimal(40),
          created_at: new Date(),
          updated_at: new Date(),
          product: { ...baseProduct, stock: 5 },
        },
      ],
    };
    (cartRepo.getOrCreate as jest.Mock).mockResolvedValue(existingCart);
    (productRepo.findById as jest.Mock).mockResolvedValue({ ...baseProduct, stock: 5 });
    (inventoryRepo.findByProductId as jest.Mock).mockResolvedValue({
      id: "inv-1",
      product_id: "p1",
      quantity: 5,
      reserved: 0,
    });
    (cartRepo.setItemQuantity as jest.Mock).mockResolvedValue({
      ...existingCart,
      items: [{ ...existingCart.items[0], quantity: 3 }],
    });

    const result = await cartService.updateItem("u1", "item-1", { quantity: 3 }, mockReq);
    expect(result.items[0]?.quantity).toBe(3);
    expect(cartRepo.setItemQuantity).toHaveBeenCalledWith("cart-1", "item-1", 3);
  });

  test("When vendor updates stock to 100 on a product with in-flight reservations, total inventory is synced to nextStock + reserved", async () => {
    const { productService } = await import("../../src/services/product.service");
    const { vendorService } = await import("../../src/services/vendor.service");
    (vendorService.getMyVendor as jest.Mock).mockResolvedValue({ id: "v1", status: "APPROVED" });
    (productRepo.findById as jest.Mock).mockResolvedValue({
      ...baseProduct,
      stock: 5,
      vendor: { id: "v1", user_id: "u-vendor", status: "APPROVED" },
    });
    (inventoryRepo.findByProductId as jest.Mock).mockResolvedValue({
      id: "inv-1",
      product_id: "p1",
      quantity: 7,
      reserved: 2, // 2 items reserved in-flight
    });
    (productRepo.updateProduct as jest.Mock).mockResolvedValue({
      ...baseProduct,
      stock: 100,
      is_available: true,
    });
    (inventoryRepo.upsertInventory as jest.Mock).mockResolvedValue({});

    await productService.update("u-vendor", "p1", { stock: 100 }, mockReq);

    // Verifies stock is updated to 100 and physical inventory is upserted to 100 + 2 (reserved) = 102
    expect(productRepo.updateProduct).toHaveBeenCalledWith("p1", expect.objectContaining({
      stock: 100,
      is_available: true,
    }));
    expect(inventoryRepo.upsertInventory).toHaveBeenCalledWith(expect.objectContaining({
      product_id: "p1",
      quantity: 102,
    }));
  });
});
