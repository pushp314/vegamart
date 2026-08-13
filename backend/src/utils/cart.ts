import prisma from "../database/prisma";
import type { CartRow } from "../repositories/cart.repository";

/**
 * Builds an in-memory {@link CartRow} from a client-supplied items list, using
 * the authoritative current product prices from the database. This lets
 * endpoints (coupon validation, checkout preview) run the exact same
 * calculations as a real persisted cart without requiring the item set to be
 * stored on the server first.
 */
export async function cartFromItems(
  userId: string,
  items: Array<{ product_id: string; quantity: number }>
): Promise<CartRow> {
  const ids = [...new Set(items.map((i) => i.product_id))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, deleted_at: null },
    select: {
      id: true,
      name: true,
      slug: true,
      unit: true,
      price: true,
      mrp: true,
      is_active: true,
      is_available: true,
      stock: true,
      vendor_id: true,
      category_id: true,
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const now = new Date();
  return {
    id: "",
    user_id: userId,
    created_at: now,
    updated_at: now,
    items: items.flatMap((i) => {
      const product = byId.get(i.product_id);
      if (!product) {
        return [];
      }
      return [
        {
          id: "",
          product_id: product.id,
          quantity: Math.max(1, i.quantity),
          selected_unit: null,
          price_snapshot: product.price,
          created_at: now,
          updated_at: now,
          product: {
            ...product,
            images: [],
          },
        },
      ];
    }),
  };
}