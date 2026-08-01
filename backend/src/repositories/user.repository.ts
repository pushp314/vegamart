import type { Prisma, User } from "@prisma/client";

import prisma from "../database/prisma";

export type UserCreateInput = Prisma.UserCreateInput;

export interface UserWithRoleAndPermissions extends User {
  role: {
    id: string;
    slug: string;
    name: string;
    role_permissions: Array<{ permission: { slug: string } }>;
  };
  vendor_profile?: { id: string } | null;
  delivery_profile?: { id: string } | null;
}

const userWithRoleSelect = {
  id: true,
  role_id: true,
  name: true,
  email: true,
  phone: true,
  password_hash: true,
  avatar_url: true,
  status: true,
  is_verified: true,
  email_verified_at: true,
  phone_verified_at: true,
  last_login_at: true,
  failed_login_attempts: true,
  locked_until: true,
  two_factor_enabled: true,
  provider: true,
  provider_id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
} as const;

const rolePermissionsSelect = {
  role: {
    select: {
      id: true,
      slug: true,
      name: true,
      role_permissions: {
        select: { permission: { select: { slug: true } } },
      },
    },
  },
} as const;

export async function findById(
  id: string,
  include: { role?: boolean; vendor?: boolean; delivery?: boolean } = {}
): Promise<UserWithRoleAndPermissions | null> {
  return prisma.user.findUnique({
    where: { id, deleted_at: null },
    select: {
      ...userWithRoleSelect,
      ...(include.role ? rolePermissionsSelect : {}),
      ...(include.vendor ? { vendor_profile: { select: { id: true } } } : {}),
      ...(include.delivery ? { delivery_profile: { select: { id: true } } } : {}),
    },
  }) as unknown as UserWithRoleAndPermissions | null;
}

export async function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findByPhone(phone: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { phone } });
}

export async function create(data: UserCreateInput): Promise<User> {
  return prisma.user.create({ data });
}

export async function update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
  return prisma.user.update({ where: { id }, data });
}

export async function softDelete(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { deleted_at: new Date(), status: "INACTIVE" },
  });
}

export async function incrementLoginFailures(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { failed_login_attempts: { increment: 1 } },
  });
}

export async function resetLoginFailures(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { failed_login_attempts: 0, locked_until: null },
  });
}

export async function setLocked(id: string, lockedUntil: Date): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { locked_until: lockedUntil },
  });
}

export async function markEmailVerified(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { is_verified: true, email_verified_at: new Date() },
  });
}

export async function setLastLogin(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { last_login_at: new Date() },
  });
}

export async function updatePassword(id: string, passwordHash: string, history: string[]): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      password_hash: passwordHash,
      password_history: history as unknown as Prisma.InputJsonValue,
      password_changed_at: new Date(),
    },
  });
}

export interface AdminUserFilter {
  q?: string;
  role?: string;
  status?: string;
  isVerified?: boolean;
  provider?: string;
}

const adminSelect = {
  id: true,
  role_id: true,
  name: true,
  email: true,
  phone: true,
  avatar_url: true,
  status: true,
  is_verified: true,
  provider: true,
  last_login_at: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  role: { select: { id: true, slug: true, name: true } },
  vendor_profile: { select: { id: true, business_name: true, status: true } },
  delivery_profile: { select: { id: true, vehicle_type: true, status: true } },
} as const;

export async function listUsersAdmin(
  filter: AdminUserFilter,
  skip: number,
  take: number
): Promise<{ rows: unknown[]; total: number }> {
  const where: Prisma.UserWhereInput = { deleted_at: null };
  if (filter.role) where.role = { slug: filter.role };
  if (filter.status) where.status = filter.status as Prisma.UserWhereInput["status"];
  if (filter.isVerified !== undefined) where.is_verified = filter.isVerified;
  if (filter.provider) where.provider = filter.provider;
  if (filter.q) {
    where.OR = [
      { name: { contains: filter.q, mode: "insensitive" } },
      { email: { contains: filter.q, mode: "insensitive" } },
      { phone: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: adminSelect,
      orderBy: { created_at: "desc" },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);
  return { rows: rows as unknown as unknown[], total };
}

export async function findByIdAdmin(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: adminSelect,
  });
}

export async function updateStatus(id: string, status: User["status"]): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { status },
  });
}

export async function restore(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { deleted_at: null, status: "ACTIVE" },
  });
}

export async function changeRole(id: string, roleId: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { role_id: roleId },
  });
}
