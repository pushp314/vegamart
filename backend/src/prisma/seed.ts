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

const SEED_VENDOR_PASSWORD = process.env.SEED_VENDOR_PASSWORD ?? "Vendor@12345";

const VENDOR_SEEDS = [
  {
    email: "vendor1@vegamart.in",
    name: "Rajesh Kumar",
    businessName: "Fresh Harvest Mart",
    slug: "fresh-harvest-mart",
    category: "Fruits & Vegetables",
    description: "Farm-fresh fruits and vegetables sourced daily from local farms.",
    address: "Shop 12, MG Road, Andheri West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400058",
    rating: 4.6,
    products: [
      {
        name: "Organic Bananas",
        slug: "organic-bananas",
        description: "Sweet, ripe organic bananas grown without pesticides.",
        price: "49",
        mrp: "59",
        unit: "1 dozen",
        tag: "Best Seller",
        is_vegetarian: true,
        stock: 120,
      },
      {
        name: "Fresh Tomatoes",
        slug: "fresh-tomatoes",
        description: "Juicy vine-ripened tomatoes, perfect for curries and salads.",
        price: "39",
        mrp: "49",
        unit: "1 kg",
        tag: "Fresh",
        is_vegetarian: true,
        stock: 200,
      },
      {
        name: "Alphonso Mangoes",
        slug: "alphonso-mangoes",
        description: "Premium Devgad Alphonso mangoes, handpicked at peak ripeness.",
        price: "149",
        mrp: "199",
        unit: "1 dozen",
        tag: "Seasonal",
        is_vegetarian: true,
        stock: 60,
      },
    ],
  },
  {
    email: "vendor2@vegamart.in",
    name: "Sunita Devi",
    businessName: "Green Grocers",
    slug: "green-grocers",
    category: "Fruits & Vegetables",
    description: "Organic produce, dairy and pantry staples delivered fresh.",
    address: "Shop 5, FC Road, Shivajinagar",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411005",
    rating: 4.4,
    products: [
      {
        name: "Baby Spinach",
        slug: "baby-spinach",
        description: "Tender baby spinach leaves, washed and ready to cook.",
        price: "35",
        mrp: "45",
        unit: "250 g",
        tag: "Organic",
        is_vegetarian: true,
        stock: 80,
      },
      {
        name: "Farm Eggs",
        slug: "farm-eggs",
        description: "Free-range brown eggs from local farms, rich in protein.",
        price: "95",
        mrp: "110",
        unit: "12 pcs",
        tag: "Fresh",
        is_vegetarian: false,
        stock: 150,
      },
      {
        name: "Whole Wheat Bread",
        slug: "whole-wheat-bread",
        description: "Stone-ground whole wheat bread, baked fresh daily.",
        price: "60",
        mrp: "75",
        unit: "1 loaf",
        tag: "Bakery",
        is_vegetarian: true,
        stock: 40,
      },
    ],
  },
];

async function seedCategories(): Promise<void> {
  const categories = [
    { name: "Fruits & Vegetables", slug: "fruits-vegetables", icon: "🍎", sort_order: 1 },
    { name: "Dairy & Eggs", slug: "dairy-eggs", icon: "🥛", sort_order: 2 },
    { name: "Bakery & Snacks", slug: "bakery-snacks", icon: "🍞", sort_order: 3 },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, icon: category.icon },
      create: {
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        sort_order: category.sort_order,
        is_active: true,
      },
    });
  }
}

async function seedVendorsAndProducts(): Promise<void> {
  const vendorRole = await prisma.role.findUnique({ where: { slug: ROLES.VENDOR } });
  if (!vendorRole) {
    throw new Error("Vendor role missing. Run role seeding first.");
  }

  for (const vendor of VENDOR_SEEDS) {
    const passwordHash = await bcrypt.hash(SEED_VENDOR_PASSWORD, 12);

    const user = await prisma.user.upsert({
      where: { email: vendor.email },
      update: { name: vendor.name },
      create: {
        name: vendor.name,
        email: vendor.email,
        password_hash: passwordHash,
        role_id: vendorRole.id,
        is_verified: true,
        email_verified_at: new Date(),
        provider: "local",
      },
    });

    const vendorProfile = await prisma.vendorProfile.upsert({
      where: { user_id: user.id },
      update: {
        business_name: vendor.businessName,
        description: vendor.description,
        is_open: true,
      },
      create: {
        user_id: user.id,
        business_name: vendor.businessName,
        slug: vendor.slug,
        description: vendor.description,
        category: vendor.category,
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        country: "India",
        pincode: vendor.pincode,
        rating: vendor.rating,
        is_open: true,
        is_verified: true,
        status: "APPROVED",
        min_order: "0",
        delivery_fee: "10",
        commission_rate: "5",
      },
    });

    for (const product of vendor.products) {
      const category = await prisma.category.findUnique({
        where: { slug: product.name.toLowerCase().includes("egg") ? "dairy-eggs" : product.name.toLowerCase().includes("bread") ? "bakery-snacks" : "fruits-vegetables" },
      });

      const created = await prisma.product.upsert({
        where: { vendor_id_slug: { vendor_id: vendorProfile.id, slug: product.slug } },
        update: {
          name: product.name,
          description: product.description,
          price: product.price,
          mrp: product.mrp,
          is_active: true,
          is_available: true,
          stock: product.stock,
        },
        create: {
          vendor_id: vendorProfile.id,
          category_id: category!.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          mrp: product.mrp,
          unit: product.unit,
          tag: product.tag,
          is_active: true,
          is_vegetarian: product.is_vegetarian,
          rating: 4.5,
          review_count: 0,
          stock: product.stock,
          is_available: true,
          images: {
            create: {
              url: `https://placehold.co/600x400/16a34a/ffffff?text=${encodeURIComponent(product.name)}`,
              alt_text: product.name,
              sort_order: 0,
              is_primary: true,
            },
          },
        },
      });

      await prisma.inventoryItem.upsert({
        where: { product_id: created.id },
        update: { quantity: product.stock, low_stock_threshold: 5 },
        create: {
          product_id: created.id,
          quantity: product.stock,
          low_stock_threshold: 5,
        },
      });
    }
  }

  console.log("✔ Seeded 2 vendors and 6 products.");
  console.log(`  Vendor password: ${SEED_VENDOR_PASSWORD}`);
}

async function main(): Promise<void> {
  console.log("Seeding Gali Connect database...");
  await seedRolesAndPermissions();
  await assignRolePermissions();
  await seedSuperAdmin();
  await seedCategories();
  await seedVendorsAndProducts();
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
