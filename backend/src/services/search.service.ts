import * as productRepo from "../repositories/product.repository";
import * as vendorRepo from "../repositories/vendor.repository";
import { boundingBox, haversineDistanceKm } from "../utils/geo";

const MAX_RESULTS = 50;

function rankProduct(query: string, product: { name: string; description: string | null; tag: string | null }): number {
  const q = query.toLowerCase();
  const name = product.name.toLowerCase();
  const description = product.description?.toLowerCase() ?? "";
  const tag = product.tag?.toLowerCase() ?? "";

  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  if (tag.includes(q)) return 3;
  if (description.includes(q)) return 4;
  return 5;
}

function rankVendor(query: string, vendor: { business_name: string; description: string | null; city: string }): number {
  const q = query.toLowerCase();
  const name = vendor.business_name.toLowerCase();
  const description = vendor.description?.toLowerCase() ?? "";
  const city = vendor.city.toLowerCase();

  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  if (city.includes(q)) return 3;
  if (description.includes(q)) return 4;
  return 5;
}

export const searchService = {
  async search(
    query: string,
    type: "products" | "vendors" | "all" = "all",
    page = 1,
    perPage = 20
  ) {
    const limit = Math.min(perPage, MAX_RESULTS);
    const skip = (page - 1) * limit;
    const q = query.trim();

    if (type === "products") {
      const { rows, total } = await productRepo.listProducts({ q }, skip, limit);
      rows.sort((a, b) => rankProduct(q, a) - rankProduct(q, b));
      return { products: rows, vendors: [], total, page, perPage: limit };
    }

    if (type === "vendors") {
      const { rows, total } = await vendorRepo.listVendors({ q }, skip, limit);
      rows.sort((a, b) => rankVendor(q, a) - rankVendor(q, b));
      return { products: [], vendors: rows, total, page, perPage: limit };
    }

    const [productResult, vendorResult] = await Promise.all([
      productRepo.listProducts({ q }, skip, limit),
      vendorRepo.listVendors({ q }, skip, limit),
    ]);

    const products = productResult.rows
      .sort((a, b) => rankProduct(q, a) - rankProduct(q, b))
      .slice(0, limit);
    const vendors = vendorResult.rows
      .sort((a, b) => rankVendor(q, a) - rankVendor(q, b))
      .slice(0, limit);

    return {
      products,
      vendors,
      total: productResult.total + vendorResult.total,
      page,
      perPage: limit,
    };
  },

  async autocomplete(query: string, limit = 8): Promise<Array<{ type: "product" | "vendor"; id: string; name: string; slug: string }>> {
    const q = query.trim();
    const cap = Math.min(limit, 20);
    const take = Math.max(cap, 1);

    const [products, vendors] = await Promise.all([
      productRepo.listProducts({ q }, 0, take),
      vendorRepo.listVendors({ q }, 0, take),
    ]);

    const productSuggestions = products.rows
      .sort((a, b) => rankProduct(q, a) - rankProduct(q, b))
      .map((p) => ({ type: "product" as const, id: p.id, name: p.name, slug: p.slug }));

    const vendorSuggestions = vendors.rows
      .sort((a, b) => rankVendor(q, a) - rankVendor(q, b))
      .map((v) => ({ type: "vendor" as const, id: v.id, name: v.business_name, slug: v.slug }));

    return [...productSuggestions, ...vendorSuggestions].slice(0, cap);
  },

  async nearbyProducts(input: {
    lat: number;
    lng: number;
    radiusKm?: number;
    categoryId?: string;
    q?: string;
    page?: number;
    perPage?: number;
  }): Promise<{
    items: Array<{
      product: productRepo.ProductRow;
      vendor: { id: string; business_name: string; slug: string };
      distance_km: number;
      estimated_delivery_minutes: number;
    }>;
    total: number;
    page: number;
    perPage: number;
  }> {
    const radius = input.radiusKm || 5;
    const page = Math.max(1, input.page ?? 1);
    const perPage = Math.min(100, Math.max(1, input.perPage ?? 20));

    const bounds = boundingBox(input.lat, input.lng, radius);
    const vendors = await vendorRepo.listWithinBoundingBox(bounds, true);

    const covered: Array<{ vendor: vendorRepo.VendorRow; distance_km: number }> = [];
    for (const vendor of vendors) {
      if (vendor.latitude === null || vendor.longitude === null) continue;
      const distance = haversineDistanceKm(input.lat, input.lng, vendor.latitude, vendor.longitude);
      if (distance > radius) continue;
      if (vendor.delivery_radius_km < distance) continue;
      covered.push({ vendor, distance_km: distance });
    }

    const vendorIds = covered.map((c) => c.vendor.id);
    const { rows, total } = await productRepo.listByVendorIds(vendorIds, {
      categoryId: input.categoryId,
      q: input.q,
      take: MAX_RESULTS,
    });

    const vendorById = new Map(covered.map((c) => [c.vendor.id, c]));
    const items = rows.map((product) => {
      const entry = vendorById.get(product.vendor_id)!;
      return {
        product,
        vendor: {
          id: entry.vendor.id,
          business_name: entry.vendor.business_name,
          slug: entry.vendor.slug,
        },
        distance_km: entry.distance_km,
        estimated_delivery_minutes: estimateDeliveryMinutes(entry.distance_km),
      };
    });

    const start = (page - 1) * perPage;
    return { items: items.slice(start, start + perPage), total, page, perPage };
  },
};

function estimateDeliveryMinutes(distanceKm: number): number {
  return Math.max(15, Math.round(15 + distanceKm * 2));
}
