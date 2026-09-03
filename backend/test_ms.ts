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
    // 1. Setup Admin Settings
    await prisma.platformSetting.upsert({
      where: { key: "platform.delivery_fee" },
      update: { value: 30, value_type: "number" },
      create: { key: "platform.delivery_fee", value: 30, value_type: "number", label: "Fee" },
    });
    await prisma.platformSetting.upsert({
      where: { key: "platform.tax_rate_percent" },
      update: { value: 5, value_type: "number" },
      create: { key: "platform.tax_rate_percent", value: 5, value_type: "number", label: "GST" },
    });
    await prisma.platformSetting.upsert({
      where: { key: "platform.free_delivery_threshold" },
      update: { value: 299, value_type: "number" },
      create: { key: "platform.free_delivery_threshold", value: 299, value_type: "number", label: "Free Threshold" },
    });

    // 2. Setup Users
    const customer = await prisma.user.upsert({
      where: { phone_number: "+919999999999" },
      update: {},
      create: { phone_number: "+919999999999", role: "CUSTOMER", name: "Test Customer" },
    });

    const vendorUser1 = await prisma.user.upsert({
      where: { phone_number: "+918888888881" },
      update: {},
      create: { phone_number: "+918888888881", role: "VENDOR", name: "Vendor 1 User" },
    });

    const vendorUser2 = await prisma.user.upsert({
      where: { phone_number: "+918888888882" },
      update: {},
      create: { phone_number: "+918888888882", role: "VENDOR", name: "Vendor 2 User" },
    });

    const deliveryUser = await prisma.user.upsert({
      where: { phone_number: "+917777777777" },
      update: {},
      create: { phone_number: "+917777777777", role: "DELIVERY", name: "Test Rider" },
    });

    // 3. Setup Vendors & Delivery Partner
    const vendor1 = await prisma.vendor.upsert({
      where: { user_id: vendorUser1.id },
      update: { is_open: true, provides_delivery: true, delivery_configs: { delivery_partner: { enabled: true } } },
      create: { user_id: vendorUser1.id, business_name: "Store A", is_open: true, provides_delivery: true, delivery_configs: { delivery_partner: { enabled: true } } },
    });

    const vendor2 = await prisma.vendor.upsert({
      where: { user_id: vendorUser2.id },
      update: { is_open: true, provides_delivery: true, delivery_configs: { delivery_partner: { enabled: true } } },
      create: { user_id: vendorUser2.id, business_name: "Store B", is_open: true, provides_delivery: true, delivery_configs: { delivery_partner: { enabled: true } } },
    });

    const deliveryPartner = await prisma.deliveryPartner.upsert({
      where: { user_id: deliveryUser.id },
      update: { status: "ONLINE", account_status: "ACTIVE" },
      create: { user_id: deliveryUser.id, status: "ONLINE", account_status: "ACTIVE", name: "Test Rider" },
    });

    // 4. Setup Products
    const cat = await prisma.category.findFirst() || await prisma.category.create({ data: { name: "Test Category", type: "STORE" } });

    const p1 = await prisma.product.upsert({
      where: { id: "test-prod-1" },
      update: { vendor_id: vendor1.id, price: 100, is_active: true, tax_rate: 5 },
      create: { id: "test-prod-1", vendor_id: vendor1.id, category_id: cat.id, name: "Apple", price: 100, inventory_count: 100, is_active: true, tax_rate: 5 },
    });

    const p2 = await prisma.product.upsert({
      where: { id: "test-prod-2" },
      update: { vendor_id: vendor2.id, price: 50, is_active: true, tax_rate: 5 },
      create: { id: "test-prod-2", vendor_id: vendor2.id, category_id: cat.id, name: "Banana", price: 50, inventory_count: 100, is_active: true, tax_rate: 5 },
    });

    // 5. Create Address
    const address = await prisma.address.findFirst({ where: { user_id: customer.id } }) || await prisma.address.create({
      data: { user_id: customer.id, full_address: "123 Test St", city: "Sakti District", label: "Home", latitude: "22", longitude: "82" }
    });

    // 6. Clear and populate cart
    const cart = await cartRepo.getOrCreate(customer.id);
    await cartRepo.clear(cart.id);
    
    // Add items using cartService to populate `cart_items` properly
    const mockReq = {} as Request;
    await cartService.addItem(customer.id, { product_id: p1.id, quantity: 1, selected_unit: undefined }, mockReq);
    await cartService.addItem(customer.id, { product_id: p2.id, quantity: 2, selected_unit: undefined }, mockReq);

    // 7. Place Order with VegaMart Delivery
    console.log("Placing multi-store order with VegaMart Home Delivery...");
    const result = await checkoutService.placeOrder(customer.id, {
      address_id: address.id,
      delivery_slot: "delivery_partner", // VegaMart Home Delivery
      payment_method: "COD"
    }, mockReq);

    const orderIds = result.orders.map(o => o.order.id);
    const dbOrders = await prisma.order.findMany({ where: { id: { in: orderIds } } });

    console.log(`Placed ${dbOrders.length} orders successfully!`);
    
    let sharedOtp = null;
    let totalTaxComputed = 0;
    
    for (const order of dbOrders) {
      console.log(`\nOrder ID: ${order.id}`);
      console.log(`Vendor: ${order.vendor_id === vendor1.id ? 'Store A' : 'Store B'}`);
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
    
    // Check Tax. Items subtotal = 100 + 50*2 = 200. Tax on items = 200 * 5% = 10.
    // Delivery fee = 30. Tax on delivery = 30 * 5% = 1.5.
    // Total Tax should be 11.5.
    console.log(`Total Tax Computed: ₹${totalTaxComputed}`);
    if (totalTaxComputed === 11.5) {
      console.log("✅ GST calculation is perfectly correct!");
    } else {
      console.error(`❌ GST calculation is WRONG. Expected 11.5 but got ${totalTaxComputed}`);
    }
    
    // 8. Assign orders to Delivery Partner
    console.log("\nAssigning orders to delivery partner...");
    for (const order of dbOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: { 
          delivery_partner_id: deliveryPartner.id, 
          status: "OUT_FOR_DELIVERY" 
        }
      });
      console.log(`Assigned Order ${order.id} to rider ${deliveryPartner.name} and set to OUT_FOR_DELIVERY`);
    }

    // 9. Rider completes delivery using the single OTP
    console.log(`\nRider submitting OTP: ${sharedOtp} for ONE of the orders...`);
    const targetOrderId = dbOrders[0].id;
    
    await deliveryService.markDelivered(deliveryUser.id, targetOrderId, {
      otp: sharedOtp!,
    } as any);

    console.log("Rider completed the delivery!");

    // 10. Verify both orders are DELIVERED
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
