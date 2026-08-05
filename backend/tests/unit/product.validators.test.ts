import { createProductSchema, updateProductSchema } from "../../src/validators/product.validators";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("createProductSchema", () => {
  it("rejects a payload without a category_id (string category is not accepted)", () => {
    const result = createProductSchema.safeParse({
      name: "Fresh Tomatoes",
      price: 40,
      mrp: 50,
      unit: "1 kg",
      category: "Vegetables",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields in strict mode", () => {
    const result = createProductSchema.safeParse({
      name: "Fresh Potatoes",
      category_id: VALID_UUID,
      price: 40,
      mrp: 50,
      unit: "1 kg",
      category: "Vegetables", // Unknown field
    });
    expect(result.success).toBe(false);
  });



  it("rejects an invalid category_id uuid", () => {
    const result = createProductSchema.safeParse({
      name: "Fresh Tomatoes",
      category_id: "not-a-uuid",
      price: 40,
      mrp: 50,
      unit: "1 kg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = createProductSchema.safeParse({
      name: "A",
      category_id: VALID_UUID,
      price: 40,
      mrp: 50,
      unit: "1 kg",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a stock value and coerces numeric strings", () => {
    const result = createProductSchema.safeParse({
      name: "Fresh Tomatoes",
      category_id: VALID_UUID,
      price: "40",
      mrp: "50",
      unit: "1 kg",
      stock: "12",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(40);
      expect(result.data.stock).toBe(12);
    }
  });
});

describe("updateProductSchema", () => {
  it("allows partial updates", () => {
    const result = updateProductSchema.safeParse({ price: 45 });
    expect(result.success).toBe(true);
  });

  it("still requires category_id to be a valid uuid when provided", () => {
    const result = updateProductSchema.safeParse({ category_id: "nope" });
    expect(result.success).toBe(false);
  });
});
