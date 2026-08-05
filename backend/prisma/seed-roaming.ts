import { logger } from "../src/config/logger";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  logger.info("Seeding roaming vendors...");
  
  // Create a base user for roaming vendors if not exists
  const vendorRole = await prisma.role.findUnique({ where: { slug: "vendor" } });
  
  if (!vendorRole) {
    logger.info("Vendor role not found. Run main seed first.");
    return;
  }

  const vendors = [
    {
      name: "Raju Fresh Chai",
      email: "raju.chai@example.com",
      slug: "raju-fresh-chai",
      category: "Tea & Snacks",
      lat: 12.9720,
      lng: 77.6200
    },
    {
      name: "Suresh Sabzi Wala",
      email: "suresh.sabzi@example.com",
      slug: "suresh-sabzi-wala",
      category: "Vegetables",
      lat: 12.9690,
      lng: 77.6220
    },
    {
      name: "Gopi Samosa Cart",
      email: "gopi.samosa@example.com",
      slug: "gopi-samosa-cart",
      category: "Snacks",
      lat: 12.9715,
      lng: 77.6240
    }
  ];

  for (const v of vendors) {
    let user = await prisma.user.findUnique({ where: { email: v.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: v.email,
          name: v.name,
          phone: "999" + Math.floor(1000000 + Math.random() * 9000000).toString(),
          password_hash: await bcrypt.hash("password123", 10),
          role_id: vendorRole.id,
          status: "ACTIVE"
        }
      });
    }

    let profile = await prisma.vendorProfile.findUnique({ where: { user_id: user.id } });
    if (!profile) {
      profile = await prisma.vendorProfile.create({
        data: {
          user_id: user.id,
          business_name: v.name,
          slug: v.slug,
          category: v.category,
          address: "Roaming around Indiranagar",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560038",
          latitude: v.lat,
          longitude: v.lng,
          roaming: true,
          status: "APPROVED",
          is_verified: true,
          is_open: true,
          rating: 4.8,
          review_count: 24,
        }
      });
      logger.info(`Created roaming vendor: ${v.name}`);
    } else {
      await prisma.vendorProfile.update({
        where: { id: profile.id },
        data: { roaming: true, is_open: true, latitude: v.lat, longitude: v.lng, status: "APPROVED" }
      });
      logger.info(`Updated roaming vendor: ${v.name}`);
    }
  }

  logger.info("Done seeding roaming vendors.");
}

main()
  .catch(logger.error)
  .finally(() => prisma.$disconnect());
