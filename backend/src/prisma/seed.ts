import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  RoleSlug,
} from "../constants/roles";

const prisma = new PrismaClient();

const ROLE_DESCRIPTIONS: Record<RoleSlug, string> = {
  customer: "Can browse, order and track purchases.",
  vendor: "Owns a storefront and manages inventory & orders.",
  delivery: "Delivers orders to customers.",
  admin: "Manages the platform, vendors, delivery partners and users.",
  super_admin: "Full platform control including settings and audit.",
};

const PERMISSION_GROUPS: Record<string, string> = {
  auth: "Authentication",
  users: "Users",
  products: "Products",
  vendors: "Vendors",
  delivery: "Delivery Partners",
  orders: "Orders",
  payments: "Payments",
  categories: "Categories",
  coupons: "Coupons",
  reviews: "Reviews",
  notifications: "Notifications",
  dashboard: "Dashboard",
  settings: "Settings",
  audit: "Audit Logs",
  reports: "Reports",
  cms: "CMS",
  broadcasts: "Broadcasts",
};

async function seedRolesAndPermissions(): Promise<void> {
  const permissions = Object.values(PERMISSIONS);

  for (const slug of permissions) {
    const group = slug.split(":")[0] ?? "system";
    await prisma.permission.upsert({
      where: { slug },
      update: { group },
      create: {
        name: slug
          .split(":")
          .map((part) => part[0]!.toUpperCase() + part.slice(1))
          .join(" "),
        slug,
        group,
        description: PERMISSION_GROUPS[group] ?? "System permission",
      },
    });
  }

  for (const slug of Object.values(ROLES) as RoleSlug[]) {
    await prisma.role.upsert({
      where: { slug },
      update: { description: ROLE_DESCRIPTIONS[slug] },
      create: {
        name: slug
          .split("_")
          .map((part) => part[0]!.toUpperCase() + part.slice(1))
          .join(" "),
        slug,
        description: ROLE_DESCRIPTIONS[slug],
        is_system: true,
      },
    });
  }
}

async function assignRolePermissions(): Promise<void> {
  for (const [roleSlug, permissionSlugs] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
    if (!role) continue;

    for (const permissionSlug of permissionSlugs) {
      const permission = await prisma.permission.findUnique({
        where: { slug: permissionSlug },
      });
      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          role_id_permission_id: {
            role_id: role.id,
            permission_id: permission.id,
          },
        },
        update: {},
        create: { role_id: role.id, permission_id: permission.id },
      });
    }
  }
}

async function seedSuperAdmin(): Promise<void> {
  const adminRole = await prisma.role.findUnique({ where: { slug: ROLES.SUPER_ADMIN } });
  if (!adminRole) {
    throw new Error("Super admin role missing. Run role seeding first.");
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@galiconnect.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`ℹ Admin user already exists (${email}). Skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name: "Super Admin",
      email,
      password_hash: passwordHash,
      role_id: adminRole.id,
      is_verified: true,
      email_verified_at: new Date(),
      provider: "local",
    },
  });

  console.log(`✔ Seeded admin user: ${email}`);
  console.log(`  Default password: ${password}`);
  console.log("  ⚠ Change this password immediately after first login!");
}

async function main(): Promise<void> {
  console.log("Seeding Gali Connect database...");
  await seedRolesAndPermissions();
  await assignRolePermissions();
  await seedSuperAdmin();
  console.log("✔ Seeding complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
