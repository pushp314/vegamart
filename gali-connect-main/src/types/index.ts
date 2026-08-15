export type VendorStatus = "pending" | "approved" | "rejected" | "suspended";

export type VendorProfile = {
  vendor_id: string;
  description?: string;
  category: string;
  tags?: string;
  logo_url?: string;
  banner_url?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  delivery_radius_km: number;
  business_hours?: string;
  min_order: number;
  delivery_fee: number;
  rating: number;
  review_count: number;
  is_open: boolean;
  provides_delivery?: boolean;
  phone?: string;
  owner_name: string;
};

export type Vendor = {
  id: string;
  user_id: string;
  business_name: string;
  slug: string;
  status: VendorStatus;
  is_verified: boolean;
  is_sponsored?: boolean;
  sponsored_until?: string | null;
  sponsored_priority?: number;
  logo_url?: string | null;
  commission_rate?: number;
  membership_tier?: string;
  membership_plan_id?: string | null;
  membership_expires_at?: string | null;
  membership_plan?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    billing_period: string;
    features: string[];
    product_limit: number;
    commission_rate: number;
    includes_sponsorship: boolean;
  } | null;
  profile?: VendorProfile;
  provides_delivery?: boolean;
  is_open?: boolean;
  distance_km?: number;
  eta_min?: number;
  free_delivery_min_order?: number;
};

export type ProductImage = {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
  is_primary: boolean;
};

export type Product = {
  id: string;
  vendor_id: string;
  category_id: string;
  subcategory_id?: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  mrp: number;
  unit: string;
  variants?: { unit: string; price: number; mrp: number }[];
  is_active: boolean;
  is_featured: boolean;
  is_vegetarian?: boolean | null;
  is_available?: boolean;
  rating: number;
  review_count: number;
  tag?: string;
  stock?: number;
  total_stock?: number;
  images?: ProductImage[];
  vendor?: Vendor;
};

export type Category = {
  id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  icon: string;
  color: string;
  image_url?: string;
  sort_order: number;
  is_active: boolean;
  vendor_count?: number;
};

/**
 * Delivery address attached to an order detail. The backend projects this from
 * the Address model and does NOT expose line1/street/city/pincode on orders -
 * `full_address` is the canonical, human-readable address string.
 */
export type OrderAddress = {
  id: string;
  label: string;
  full_address: string;
  landmark: string | null;
  country: string | null;
};

export type CouponType = "PERCENTAGE" | "FIXED" | "FREE_DELIVERY";

export type Coupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  max_discount: number | null;
  min_order_value: number | null;
  usage_limit: number;
  per_user_limit: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
};

/** Shape returned by POST /coupons/validate. */
export type CouponValidation = {
  coupon: Pick<Coupon, "id" | "code" | "type">;
  discount: number;
  eligible_subtotal: number;
  group_discounts: Record<string, number>;
};
