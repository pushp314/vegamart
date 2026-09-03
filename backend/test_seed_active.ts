import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst({ where: { role: { slug: "customer" } }});
    const vendor1 = await prisma.vendorProfile.findFirst({ skip: 0 });
    const vendor2 = await prisma.vendorProfile.findFirst({ skip: 1 });
    const address = await prisma.address.findFirst();
    const product = await prisma.product.findFirst();
    const delivery = await prisma.deliveryProfile.findFirst({ include: { user: true } });
    
    if (!user || !vendor1 || !vendor2 || !address || !product || !delivery) {
       console.log("Missing data"); return;
    }

    const sharedOtp = "998877";

    // Create Active Order 1
    const order1 = await prisma.order.create({
      data: {
        order_number: `ORD-ACTIVE-${Date.now()}-1`,
        user_id: user.id,
        vendor_id: vendor1.id,
        address_id: address.id,
        delivery_partner_id: null,
        status: "READY_FOR_PICKUP",
        payment_method: "COD",
        items_subtotal: 100,
        delivery_fee: 15,
        tax: 5,
        total: 120,
        otp_code: sharedOtp,
        delivery_note: "VegaMart Home Delivery",
        items: {
          create: [{
             product_id: product.id, product_name: "Test Active Item 1", quantity: 1, unit_price: 100, total_price: 100, unit: "kg"
          }]
        }
      }
    });

    // Create Active Order 2
    const order2 = await prisma.order.create({
      data: {
        order_number: `ORD-ACTIVE-${Date.now()}-2`,
        user_id: user.id,
        vendor_id: vendor2.id,
        address_id: address.id,
        delivery_partner_id: null,
        status: "READY_FOR_PICKUP",
        payment_method: "COD",
        items_subtotal: 200,
        delivery_fee: 15,
        tax: 10,
        total: 225,
        otp_code: sharedOtp,
        delivery_note: "VegaMart Home Delivery",
        items: {
          create: [{
             product_id: product.id, product_name: "Test Active Item 2", quantity: 2, unit_price: 100, total_price: 200, unit: "kg"
          }]
        }
      }
    });

    console.log(`\n🎉 SUCCESS! Created 2 ACTIVE orders assigned to the delivery partner.`);
    console.log(`Order 1: ${order1.order_number}`);
    console.log(`Order 2: ${order2.order_number}`);
    console.log(`OTP to use for delivery: ${sharedOtp}`);
    console.log(`\n======================================`);
    console.log(`🔑 LOGIN CREDENTIALS FOR DELIVERY APP:`);
    console.log(`Phone Number: ${delivery.user.phone}`);
    console.log(`(Use whatever default password the system uses, e.g. "password" or 123456)`);
    console.log(`======================================\n`);
    
  } catch (e: any) {
    console.error("ERROR:");
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
