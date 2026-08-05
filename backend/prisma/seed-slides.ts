import { logger } from "../src/config/logger";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.heroSlide.create({
    data: {
      title: "Fresh Vegetables Delivered Fast",
      subtitle: "Farm to door in 30 minutes",
      body: "Get the freshest organic vegetables right to your doorstep. Supporting local farmers.",
      image_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1600",
      link_url: "/street-vendors?category=Vegetables",
      link_text: "Shop Veggies",
      is_active: true,
      sort_order: 1
    }
  });
  logger.info("Seeded hero slides");
}

main().catch(logger.error).finally(() => prisma.$disconnect());
