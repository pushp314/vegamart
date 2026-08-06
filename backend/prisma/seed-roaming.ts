import { logger } from "../src/config/logger";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

interface RoamingVendorSeed {
  name: string;
  email: string;
  slug: string;
  category: string;
  area: string;
  pincode: string;
  lat: number;
  lng: number;
  tags: string[];
}

// Cluster of live street vendors around the radar's default location
// (12.9715, 77.6405 — Ulsoor / Halasuru / Indiranagar, Bengaluru).
const VENDORS: RoamingVendorSeed[] = [
  {
    name: "Subbamma's Veg Cart",
    email: "subbamma.veg@example.com",
    slug: "subbamma-veg-cart",
    category: "Vegetables",
    area: "Ulsoor",
    pincode: "560008",
    lat: 12.9721,
    lng: 77.6392,
    tags: ["Fresh vegetables", "Daily market", "Tomatoes"],
  },
  {
    name: "Mango Season Fruit Cart",
    email: "mango.season@example.com",
    slug: "mango-season-fruit-cart",
    category: "Fruits",
    area: "Ulsoor",
    pincode: "560008",
    lat: 12.9708,
    lng: 77.6418,
    tags: ["Seasonal fruits", "Mangoes", "Coconuts"],
  },
  {
    name: "Amul Ice Cream Wala",
    email: "amul.icecream@example.com",
    slug: "amul-ice-cream-wala",
    category: "Ice Cream",
    area: "Ulsoor Lake",
    pincode: "560008",
    lat: 12.9732,
    lng: 77.641,
    tags: ["Ice cream", "Kulfi", "Desserts"],
  },
  {
    name: "Samosa Junction",
    email: "samosa.junction@example.com",
    slug: "samosa-junction",
    category: "Snacks",
    area: "Cambridge Road",
    pincode: "560008",
    lat: 12.9703,
    lng: 77.6385,
    tags: ["Samosa", "Evening snacks", "Chai"],
  },
  {
    name: "Fresh Sabzi Stall",
    email: "fresh.sabzi@example.com",
    slug: "fresh-sabzi-stall",
    category: "Vegetables",
    area: "Halasuru",
    pincode: "560008",
    lat: 12.9728,
    lng: 77.6431,
    tags: ["Green veggies", "Leafy greens", "Root veg"],
  },
  {
    name: "Banana Bros",
    email: "banana.bros@example.com",
    slug: "banana-bros",
    category: "Fruits",
    area: "Ulsoor",
    pincode: "560008",
    lat: 12.9695,
    lng: 77.6422,
    tags: ["Bananas", "Papaya", "Pomegranate"],
  },
  {
    name: "Bhel Puri Corner",
    email: "bhel.puri@example.com",
    slug: "bhel-puri-corner",
    category: "Snacks",
    area: "Indiranagar",
    pincode: "560038",
    lat: 12.974,
    lng: 77.639,
    tags: ["Bhel puri", "Golgappa", "Chaats"],
  },
  {
    name: "Cut Fruit Express",
    email: "cut.fruit@example.com",
    slug: "cut-fruit-express",
    category: "Fruits",
    area: "CMH Road",
    pincode: "560038",
    lat: 12.97,
    lng: 77.6375,
    tags: ["Cut fruit", "Fruit bowls", "Coconut water"],
  },
  {
    name: "Ganesh Tea Kade",
    email: "ganesh.tea@example.com",
    slug: "ganesh-tea-kade",
    category: "Snacks",
    area: "Indiranagar",
    pincode: "560038",
    lat: 12.9735,
    lng: 77.637,
    tags: ["Cutting chai", "Vada pav", "Biscuits"],
  },
  {
    name: "Golgappa Wala",
    email: "golgappa.wala@example.com",
    slug: "golgappa-wala",
    category: "Snacks",
    area: "Halasuru",
    pincode: "560008",
    lat: 12.9725,
    lng: 77.644,
    tags: ["Golgappa", "Pani puri", "Sev puri"],
  },
];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function seedVendor(v: RoamingVendorSeed) {
  const vendorRole = await prisma.role.findUnique({ where: { slug: "vendor" } });
  if (!vendorRole) {
    throw new Error("Vendor role not found. Run the main seed first (npm run prisma:seed).");
  }

  let user = await prisma.user.findUnique({ where: { email: v.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: v.email,
        name: v.name,
        phone: "999" + Math.floor(1000000 + Math.random() * 9000000).toString(),
        password_hash: await bcrypt.hash("password123", 10),
        role_id: vendorRole.id,
        status: "ACTIVE",
      },
    });
  }

  let profile = await prisma.vendorProfile.findUnique({ where: { user_id: user.id } });
  if (!profile) {
    profile = await prisma.vendorProfile.create({
      data: {
        user_id: user.id,
        business_name: v.name,
        slug: v.slug,
        description: `${v.tags.join(", ")}. Roaming street vendor in ${v.area}, Bengaluru.`,
        category: v.category,
        tags: JSON.stringify(v.tags),
        address: `Roaming around ${v.area}`,
        landmark: v.area,
        city: "Bengaluru",
        state: "Karnataka",
        pincode: v.pincode,
        latitude: v.lat,
        longitude: v.lng,
        delivery_radius_km: 3,
        roaming: true,
        status: "APPROVED",
        is_verified: true,
        is_open: true,
        rating: 4.2 + Math.round(Math.random() * 7) / 10,
        review_count: 12 + Math.floor(Math.random() * 90),
      },
    });
    logger.info(`Created roaming vendor: ${v.name}`);
  } else {
    await prisma.vendorProfile.update({
      where: { id: profile.id },
      data: {
        roaming: true,
        is_open: true,
        latitude: v.lat,
        longitude: v.lng,
        status: "APPROVED",
        category: v.category,
        tags: JSON.stringify(v.tags),
      },
    });
    logger.info(`Updated roaming vendor: ${v.name}`);
  }

  await prisma.vendorDailyLocation.upsert({
    where: {
      vendor_id_broadcast_date: { vendor_id: profile.id, broadcast_date: startOfToday() },
    },
    update: {
      area: v.area,
      landmark: v.area,
      address: `Roaming around ${v.area}`,
      latitude: v.lat,
      longitude: v.lng,
      start_time: "08:00",
      end_time: "21:00",
      is_active: true,
    },
    create: {
      vendor_id: profile.id,
      broadcast_date: startOfToday(),
      area: v.area,
      landmark: v.area,
      address: `Roaming around ${v.area}`,
      latitude: v.lat,
      longitude: v.lng,
      start_time: "08:00",
      end_time: "21:00",
      notes: "Live on the street radar",
      is_active: true,
    },
  });
}

async function main() {
  logger.info("Seeding live street vendors for the radar...");
  for (const v of VENDORS) {
    await seedVendor(v);
  }
  logger.info(`Done. Seeded ${VENDORS.length} live roaming vendors.`);
}

main()
  .catch((err) => {
    logger.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
