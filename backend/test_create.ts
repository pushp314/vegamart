import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  try {
    const input = {
      order_number: "ORD-20260816-123456",
      user_id: "c129ffd5-2763-4828-8a0b-e5f1da2f8659",
      vendor_id: "6792370e-3ca4-4182-965e-e672d96e51fc",
      address_id: "c847eafc-3ce8-47af-8ed8-1c6389fc8509",
      coupon_id: null,
      coupon_discount: 0,
      items_subtotal: 10,
      delivery_fee: 5,
      tax: 0,
      total: 15,
      payment_method: "RAZORPAY",
      delivery_note: "Test note",
      items: [
        {
          product_id: "f0f0f7f2-174d-4ec4-ba05-0fa8f95626a5",
          product_name: "Test",
          unit: "kg",
          selected_unit: null,
          quantity: 1,
          unit_price: 10,
          total_price: 10,
          image_url: null,
        }
      ]
    };

    const row = await prisma.order.create({
      data: {
        order_number: input.order_number,
        user_id: input.user_id,
        vendor_id: input.vendor_id,
        address_id: input.address_id,
        coupon_id: input.coupon_id,
        discount: input.coupon_discount,
        items_subtotal: input.items_subtotal,
        delivery_fee: input.delivery_fee,
        tax: input.tax,
        total: input.total,
        payment_method: "RAZORPAY",
        delivery_note: input.delivery_note ?? null,
        items: {
          create: input.items.map((item) => ({
            product: { connect: { id: item.product_id } },
            product_name: item.product_name,
            unit: item.unit,
            selected_unit: item.selected_unit ?? null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            image_url: item.image_url ?? null,
          })),
        },
      },
    });
    console.log("SUCCESS!", row);
  } catch (e: any) {
    console.error("ERROR:");
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
