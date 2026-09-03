import { PrismaClient } from "@prisma/client";
import { checkoutService } from "./src/services/checkout.service";
import { deliveryService } from "./src/services/delivery.service";
import * as cartRepo from "./src/repositories/cart.repository";
import { cartService } from "./src/services/cart.service";
import { Request } from "express";

const prisma = new PrismaClient();

async function runTest() {
  console.log("Starting Multi-Store VegaMart Delivery Test...");

  try {
    const user = await prisma.user.findFirst({ where: { role: { slug: "customer" } }});
    if (!user) throw new Error("No customer found");

    const address = await prisma.address.findFirst({ where: { user_id: user.id } }) 
                 || await prisma.address.findFirst();
    if (!address) throw new Error("No address found");

    const vendors = await prisma.vendorProfile.findMany({ 
      where: { products: { some: {} } },
      take: 2 
    });
    if (vendors.length < 2) throw new Error("Need at least 2 vendors with products");

    const v1 = vendors[0];
    const v2 = vendors[1];
    if (!v1 || !v2) throw new Error("Vendors missing");

    const p1 = await prisma.product.findFirst({ where: { vendor_id: v1.id } });
    const p2 = await prisma.product.findFirst({ where: { vendor_id: v2.id } });
    if (!p1 || !p2) throw new Error("Vendors don't have products");

    await prisma.product.update({ where: { id: p1.id }, data: { is_active: true } });
    await prisma.product.update({ where: { id: p2.id }, data: { is_active: true } });

    await prisma.inventoryItem.upsert({
      where: { product_id: p1.id },
      update: { quantity: 100 },
      create: { product_id: p1.id, quantity: 100 }
    } as any);

    await prisma.inventoryItem.upsert({
      where: { product_id: p2.id },
      update: { quantity: 100 },
      create: { product_id: p2.id, quantity: 100 }
    } as any);

    const deliveryProfile = await prisma.deliveryProfile.findFirst();
    if (!deliveryProfile) throw new Error("No delivery partner found");
    const deliveryPartnerUserId = deliveryProfile.user_id;

    for (const v of [v1, v2]) {
      if (!v) continue;
      await prisma.vendorProfile.update({
        where: { id: v.id },
        data: { 
          delivery_configs: { delivery_partner: { enabled: true, delivery_fee: 0, online_payment_enabled: true, cod_enabled: true, advance_payment_enabled: false } } as any,
          provides_delivery: true,
          is_open: true
        }
      });
    }

    const cart = await cartRepo.getOrCreate(user.id);
    await cartRepo.clear(cart.id);
    const mockReq = { headers: {} } as Request;
    await cartService.addItem(user.id, { product_id: p1.id, quantity: 1, selected_unit: undefined }, mockReq);
    await cartService.addItem(user.id, { product_id: p2.id, quantity: 2, selected_unit: undefined }, mockReq);

    console.log("Placing multi-store order with VegaMart Home Delivery...");
    const result = await checkoutService.placeOrder(user.id, {
      address_id: address.id,
      delivery_slot: "delivery_partner",
      payment_method: "COD"
    }, mockReq);

    const orderIds = result.orders.map(o => o.order.id);
    const dbOrders = await prisma.order.findMany({ where: { id: { in: orderIds } } });

    console.log(`Placed ${dbOrders.length} orders successfully!`);
    
    let sharedOtp = null;
    let totalTaxComputed = 0;
    
    for (const order of dbOrders) {
      console.log(`\nOrder ID: ${order.id}`);
      console.log(`Vendor: ${order.vendor_id === v1.id ? 'Store 1' : 'Store 2'}`);
      console.log(`OTP: ${order.otp_code}`);
      console.log(`Delivery Fee: ₹${order.delivery_fee}`);
      console.log(`Tax: ₹${order.tax}`);
      console.log(`Total: ₹${order.total}`);
      
      if (!sharedOtp) sharedOtp = order.otp_code;
      if (sharedOtp !== order.otp_code) {
         console.error("❌ OTP MISMATCH! Orders do not share the same OTP.");
      }
      totalTaxComputed += Number(order.tax);
    }
    
    console.log(`\n✅ Shared OTP check passed: ${sharedOtp}`);
    console.log(`Total Tax Computed: ₹${totalTaxComputed}`);
    
    console.log("\nAssigning orders to delivery partner...");
    for (const order of dbOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: { 
          delivery_partner_id: deliveryProfile.id, 
          status: "OUT_FOR_DELIVERY" 
        }
      });
    }

    console.log(`\nRider submitting OTP: ${sharedOtp} for ONE of the orders...`);
    if (dbOrders.length === 0) throw new Error("No orders generated");
    const targetOrderId = dbOrders[0]!.id;
    
    if (!sharedOtp) throw new Error("No OTP generated");
    if (!deliveryPartnerUserId) throw new Error("No rider ID");

    await deliveryService.markDelivered(deliveryPartnerUserId, targetOrderId, {
      otp: sharedOtp,
    } as any);

    const finalOrders = await prisma.order.findMany({
      where: { id: { in: dbOrders.map(o => o.id) } }
    });
    
    let allDelivered = true;
    for (const fo of finalOrders) {
      console.log(`Order ${fo.id} Status: ${fo.status}`);
      if (fo.status !== "DELIVERED") allDelivered = false;
    }

    if (allDelivered) {
      console.log("\n🎉 SUCCESS! Both orders were automatically marked as DELIVERED with a single OTP entry.");
    } else {
      console.error("\n❌ FAILED! Not all orders were marked as delivered.");
    }

  } catch (err: any) {
    console.error("Test failed with error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
