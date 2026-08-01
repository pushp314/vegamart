import type { User } from "@prisma/client";

export interface SerializedUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  is_verified: boolean;
  provider: string | null;
  created_at: string;
  vendor_id?: string | null;
  delivery_id?: string | null;
  permissions?: string[];
}

type UserWithRelations = User & {
  role: { slug: string };
  vendor_profile?: { id: string } | null;
  delivery_profile?: { id: string } | null;
};

export function serializeUser(user: UserWithRelations, withPermissions = false): SerializedUser {
  const serialized: SerializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role.slug,
    avatar_url: user.avatar_url ?? null,
    is_verified: user.is_verified,
    provider: user.provider ?? null,
    created_at: user.created_at.toISOString(),
    vendor_id: user.vendor_profile?.id ?? null,
    delivery_id: user.delivery_profile?.id ?? null,
  };

  if (withPermissions) {
    serialized.permissions = [];
  }

  return serialized;
}
