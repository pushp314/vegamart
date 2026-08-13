import process from "node:process";
import { PrismaClient, VendorStatus, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLES } from "../src/constants/roles";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding requested users (Admin, Vendor, Customer)...");

  // 1. Fetch Roles
  const adminRole = await prisma.role.findUnique({ where: { slug: ROLES.SUPER_ADMIN } }) ||
                    await prisma.role.findUnique({ where: { slug: ROLES.ADMIN } });
  const vendorRole = await prisma.role.findUnique({ where: { slug: ROLES.VENDOR } });
  const customerRole = await prisma.role.findUnique({ where: { slug: ROLES.CUSTOMER } });

  if (!adminRole || !vendorRole || !customerRole) {
    throw new Error("Required roles not found in DB. Make sure database migrations and role seeding have run.");
  }

  // 2. Admin User
  const adminEmail = "vegamart.com@gmail.com";
  const adminPasswordHash = await bcrypt.hash("Vegamart@8640017166", 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password_hash: adminPasswordHash,
      role_id: adminRole.id,
      status: UserStatus.ACTIVE,
      is_verified: true,
      email_verified_at: new Date(),
    },
    create: {
      name: "Vegamart Admin",
      email: adminEmail,
      password_hash: adminPasswordHash,
      role_id: adminRole.id,
      status: UserStatus.ACTIVE,
      is_verified: true,
      email_verified_at: new Date(),
      provider: "local",
    },
  });
  console.log(`✅ Admin user seeded: ${admin.email}`);

  // 3. Vendor User & Profile
  const vendorEmail = "vendor@vegamart.in";
  const vendorPasswordHash = await bcrypt.hash("Vendor@12345", 12);
  const vendorUser = await prisma.user.upsert({
    where: { email: vendorEmail },
    update: {
      password_hash: vendorPasswordHash,
      role_id: vendorRole.id,
      status: UserStatus.ACTIVE,
      is_verified: true,
      email_verified_at: new Date(),
    },
    create: {
      name: "Vegamart Prime Vendor",
      email: vendorEmail,
      password_hash: vendorPasswordHash,
      role_id: vendorRole.id,
      status: UserStatus.ACTIVE,
      is_verified: true,
      email_verified_at: new Date(),
      provider: "local",
    },
  });

  await prisma.vendorProfile.upsert({
    where: { user_id: vendorUser.id },
    update: {
      business_name: "Vegamart Prime Store",
      status: VendorStatus.APPROVED,
      is_verified: true,
      is_open: true,
    },
    create: {
      user_id: vendorUser.id,
      business_name: "Vegamart Prime Store",
      slug: "vegamart-prime-store",
      description: "Official store for fresh fruits, vegetables, and daily staples.",
      category: "Fruits & Vegetables",
      address: "Shop 1, Main Market Road",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      delivery_radius_km: 15,
      provides_delivery: true,
      status: VendorStatus.APPROVED,
      is_verified: true,
      is_open: true,
      rating: 5.0,
      review_count: 1,
    },
  });
  console.log(`✅ Vendor user & profile seeded: ${vendorUser.email}`);

  // 4. Customer User
  const customerEmail = "customer@vegamart.in";
  const customerPasswordHash = await bcrypt.hash("Customer@12345", 12);
  const customer = await prisma.user.upsert({
    where: { email: customerEmail },
    update: {
      password_hash: customerPasswordHash,
      role_id: customerRole.id,
      status: UserStatus.ACTIVE,
      is_verified: true,
      email_verified_at: new Date(),
    },
    create: {
      name: "Vegamart Customer",
      email: customerEmail,
      password_hash: customerPasswordHash,
      role_id: customerRole.id,
      status: UserStatus.ACTIVE,
      is_verified: true,
      email_verified_at: new Date(),
      provider: "local",
    },
  });
  console.log(`✅ Customer user seeded: ${customer.email}`);

  console.log("\n🎉 All 3 accounts created/updated successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding accounts:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
