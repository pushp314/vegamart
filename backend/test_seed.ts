import { PrismaClient } from "@prisma/client";
import { deliveryService } from "./src/services/delivery.service";

const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst({ where: { role: { slug: "customer" } }});
    const vendor1 = await prisma.vendorProfile.findFirst({ skip: 0 });
    const vendor2 = await prisma.vendorProfile.findFirst({ skip: 1 });
    const address = await prisma.address.findFirst();
    const product = await prisma.product.findFirst();
    const delivery = await prisma.deliveryProfile.findFirst();
    
    if (!user || !vendor1 || !vendor2 || !address || !product || !delivery) {
       console.log("Missing data"); return;
    }

    const sharedOtp = "123456";

    // Create Order 1
    const order1 = await prisma.order.create({
      data: {
        order_number: "ORD-TEST-001",
        user_id: user.id,
        vendor_id: vendor1.id,
        address_id: address.id,
        delivery_partner_id: delivery.id,
        status: "OUT_FOR_DELIVERY",
        payment_method: "COD",
        items_subtotal: 100,
        delivery_fee: 15,
        tax: 5,
        total: 120,
        otp_code: sharedOtp,
        delivery_note: "Test Order 1",
        items: {
          create: [{
             product_id: product.id, product_name: "Test Item 1", quantity: 1, unit_price: 100, total_price: 100, unit: "kg"
          }]
        }
      }
    });

    // Create Order 2
    const order2 = await prisma.order.create({
      data: {
        order_number: `ORD-TEST-${Date.now() + 1}`,
        user_id: user.id,
        vendor_id: vendor2.id,
        address_id: address.id,
        delivery_partner_id: delivery.id,
        status: "OUT_FOR_DELIVERY",
        payment_method: "COD",
        items_subtotal: 200,
        delivery_fee: 15,
        tax: 10,
        total: 225,
        otp_code: sharedOtp,
        delivery_note: "Test Order 2",
        items: {
          create: [{
             product_id: product.id, product_name: "Test Item 2", quantity: 2, unit_price: 100, total_price: 200, unit: "kg"
          }]
        }
      }
    });

    console.log(`Created Order 1: ${order1.id} (OTP: ${sharedOtp})`);
    console.log(`Created Order 2: ${order2.id} (OTP: ${sharedOtp})`);

    console.log(`\nTesting deliveryService.markDelivered with OTP ${sharedOtp}...`);
    await deliveryService.markDelivered(delivery.user_id, order1.id, { otp: sharedOtp } as any);

    console.log("markDelivered succeeded!");

    // Verify both orders are DELIVERED
    const finalOrder1 = await prisma.order.findUnique({ where: { id: order1.id } });
    const finalOrder2 = await prisma.order.findUnique({ where: { id: order2.id } });

    console.log(`Order 1 Status: ${finalOrder1?.status}`);
    console.log(`Order 2 Status: ${finalOrder2?.status}`);

    if (finalOrder1?.status === "DELIVERED" && finalOrder2?.status === "DELIVERED") {
      console.log("\n🎉 SUCCESS! Shared OTP marked both orders as delivered!");
    } else {
      console.log("\n❌ FAILED! Orders were not both marked as delivered.");
    }
  } catch (e: any) {
    console.error("ERROR:");
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
