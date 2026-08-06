import { logger } from "../src/config/logger";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

interface DeliverySeed {
  name: string;
  email: string;
  vehicle_type: string;
  vehicle_number: string;
  license_number: string;
  lat: number;
  lng: number;
}

// Delivery partners clustered around the radar's default location
// (12.9715, 77.6405 — Ulsoor / Halasuru / Indiranagar, Bengaluru).
const PARTNERS: DeliverySeed[] = [
  {
    name: "Ravi Kumar",
    email: "ravi.delivery@example.com",
    vehicle_type: "Motorbike",
    vehicle_number: "KA-01-AB-1234",
    license_number: "KA20190001234",
    lat: 12.9718,
    lng: 77.6402,
  },
  {
    name: "Suresh Patil",
    email: "suresh.delivery@example.com",
    vehicle_type: "Scooter",
    vehicle_number: "KA-05-CD-5678",
    license_number: "KA05201805678",
    lat: 12.9705,
    lng: 77.6411,
  },
  {
    name: "Imran Khan",
    email: "imran.delivery@example.com",
    vehicle_type: "EV Bike",
    vehicle_number: "KA-03-EF-9012",
    license_number: "KA03202009012",
    lat: 12.9727,
    lng: 77.6389,
  },
  {
    name: "Mohan Raj",
    email: "mohan.delivery@example.com",
    vehicle_type: "Bicycle",
    vehicle_number: "KA-04-GH-3456",
    license_number: "KA04202103456",
    lat: 12.9733,
    lng: 77.6423,
  },
];

async function seedPartner(p: DeliverySeed) {
  const deliveryRole = await prisma.role.findUnique({ where: { slug: "delivery" } });
  if (!deliveryRole) {
    throw new Error("Delivery role not found. Run the main seed first (npm run prisma:seed).");
  }

  let user = await prisma.user.findUnique({ where: { email: p.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: p.email,
        name: p.name,
        phone: "88" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        password_hash: await bcrypt.hash("password123", 10),
        role_id: deliveryRole.id,
        status: "ACTIVE",
        is_verified: true,
      },
    });
  }

  let profile = await prisma.deliveryProfile.findUnique({ where: { user_id: user.id } });
  if (!profile) {
    profile = await prisma.deliveryProfile.create({
      data: {
        user_id: user.id,
        vehicle_type: p.vehicle_type,
        vehicle_number: p.vehicle_number,
        license_number: p.license_number,
        status: "APPROVED",
        is_verified: true,
        is_available: true,
        availability_status: "ONLINE",
        current_lat: p.lat,
        current_lng: p.lng,
        rating: 4.5 + Math.round(Math.random() * 4) / 10,
        review_count: 8 + Math.floor(Math.random() * 60),
      },
    });
    logger.info(`Created delivery partner: ${p.name}`);
  } else {
    await prisma.deliveryProfile.update({
      where: { id: profile.id },
      data: {
        status: "APPROVED",
        is_verified: true,
        is_available: true,
        availability_status: "ONLINE",
        current_lat: p.lat,
        current_lng: p.lng,
      },
    });
    logger.info(`Updated delivery partner: ${p.name}`);
  }
}

async function main() {
  logger.info("Seeding delivery partners...");
  for (const p of PARTNERS) {
    await seedPartner(p);
  }
  logger.info(`Done. Seeded ${PARTNERS.length} delivery partners.`);
}

main()
  .catch((err) => {
    logger.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
