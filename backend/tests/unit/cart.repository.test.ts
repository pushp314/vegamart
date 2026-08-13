jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    cart: { upsert: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    cartItem: { upsert: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
  },
}));

import prisma from "../../src/database/prisma";
import { getOrCreate } from "../../src/repositories/cart.repository";

const db = prisma as jest.Mocked<typeof prisma>;

const cartRow = {
  id: "cart-1",
  user_id: "u1",
  created_at: new Date("2026-08-13T00:00:00Z"),
  updated_at: new Date("2026-08-13T00:00:00Z"),
};

describe("cart repository — getOrCreate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a single atomic upsert (no find-then-create race)", async () => {
    (db.cart.upsert as jest.Mock).mockResolvedValue(cartRow);

    const cart = await getOrCreate("u1");

    expect(cart.id).toBe("cart-1");
    expect(db.cart.upsert).toHaveBeenCalledWith({
      where: { user_id: "u1" },
      update: {},
      create: { user_id: "u1" },
      select: expect.anything(),
    });
    expect(db.cart.findUnique).not.toHaveBeenCalled();
    expect(db.cart.create).not.toHaveBeenCalled();
  });

  it("returns the newly created cart when none existed", async () => {
    (db.cart.upsert as jest.Mock).mockResolvedValue(cartRow);

    const cart = await getOrCreate("u1");

    expect(cart).toMatchObject({ id: "cart-1", user_id: "u1" });
  });
});
