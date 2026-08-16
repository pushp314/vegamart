import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.order.create({
      data: {
        order_number: "ORD-TEST-12345",
        user_id: "00000000-0000-0000-0000-000000000000",
        vendor_id: "00000000-0000-0000-0000-000000000000",
        address_id: "00000000-0000-0000-0000-000000000000",
        items_subtotal: 100,
        delivery_fee: 10,
        tax: 0,
        total: 110,
        payment_method: "RAZORPAY",
        items: {
          create: [{
            product_id: "00000000-0000-0000-0000-000000000000",
            product_name: "Test",
            unit: "kg",
            quantity: 1,
            unit_price: 100,
            total_price: 100,
          }]
        }
      }
    });
  } catch (err: any) {
    console.log("PRISMA ERROR:", err.message.substring(0, 500));
  }
}
main();
