import type { Prisma } from "@prisma/client";

import prisma from "../database/prisma";

const baseSelect = {
  id: true,
  user_id: true,
  label: true,
  full_address: true,
  landmark: true,
  city: true,
  state: true,
  pincode: true,
  country: true,
  latitude: true,
  longitude: true,
  is_default: true,
  phone: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
} as const;

export type AddressRow = {
  id: string;
  user_id: string;
  label: string;
  full_address: string;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  phone: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export async function findById(id: string): Promise<AddressRow | null> {
  const row = await prisma.address.findUnique({
    where: { id },
    select: baseSelect,
  });
  return row as unknown as AddressRow | null;
}

export async function listByUser(userId: string): Promise<AddressRow[]> {
  const rows = await prisma.address.findMany({
    where: { user_id: userId, deleted_at: null },
    select: baseSelect,
    orderBy: [{ is_default: "desc" }, { created_at: "desc" }],
  });
  return rows as unknown as AddressRow[];
}

export async function create(data: {
  user_id: string;
  label: string;
  full_address: string;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  is_default?: boolean;
}): Promise<AddressRow> {
  const row = await prisma.address.create({
    data: {
      user_id: data.user_id,
      label: data.label,
      full_address: data.full_address,
      landmark: data.landmark ?? null,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      country: data.country ?? "India",
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      phone: data.phone ?? null,
      is_default: data.is_default ?? false,
    },
    select: baseSelect,
  });
  return row as unknown as AddressRow;
}

export async function update(id: string, data: Prisma.AddressUpdateInput): Promise<AddressRow> {
  const row = await prisma.address.update({
    where: { id },
    data,
    select: baseSelect,
  });
  return row as unknown as AddressRow;
}

export async function updateManyClearDefault(userId: string): Promise<void> {
  await prisma.address.updateMany({
    where: { user_id: userId, is_default: true },
    data: { is_default: false },
  });
}

export async function softDelete(id: string): Promise<void> {
  await prisma.address.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
}
