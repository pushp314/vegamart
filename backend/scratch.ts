import { PrismaClient, Prisma } from "@prisma/client";

// This forces TS to tell me if the object is missing any required fields!
const item: Prisma.OrderItemCreateWithoutOrderInput = {
  product_id: "00000000-0000-0000-0000-000000000000",
  product_name: "Test",
  unit: "kg",
  selected_unit: null,
  quantity: 1,
  unit_price: 100,
  total_price: 100,
  image_url: null,
};
console.log("TS compiles!");
