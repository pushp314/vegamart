const fs = require('fs');
const path = 'backend/src/services/payment.service.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
    'import * as paymentRepo from "../repositories/payment.repository";',
    'import prisma from "../database/prisma";\nimport * as paymentRepo from "../repositories/payment.repository";'
);

code = code.replace(
  /async handlePaymentCaptured[\s\S]*?(?=async processRefund)/,
  `async handlePaymentCaptured(entity: CapturedPaymentEntity): Promise<void> {
    const razorpayOrderId = entity.order_id;
    if (!razorpayOrderId) return;

    const payment = await paymentRepo.findByRazorpayOrderId(razorpayOrderId);
    if (!payment) return;

    let order: any = null;
    let isMaster = false;
    if (payment.master_order_id) {
        order = await prisma.masterOrder.findUnique({ where: { id: payment.master_order_id }, include: { orders: true } });
        isMaster = true;
    } else if (payment.order_id) {
        order = await prisma.order.findUnique({ where: { id: payment.order_id } });
    }
    if (!order) return;

    assertCapturedPayment(entity, payment);

    const claimed = await paymentRepo.claimAsPaid(payment.id, {
      razorpay_payment_id: entity.id,
      razorpay_signature: undefined as never,
      gateway_response: entity as never,
    });
    if (claimed === 0) return;

    const amountPaid = payment.amount.toNumber();

    if (isMaster) {
        await prisma.masterOrder.update({
            where: { id: order.id },
            data: { payment_status: "PAID", payment_method: "RAZORPAY", status: order.status === "PENDING" ? "ACCEPTED" : undefined }
        });
        
        for (const subOrder of order.orders) {
            await prisma.order.update({ where: { id: subOrder.id }, data: { payment_status: "PAID", payment_method: "RAZORPAY" } });
            if (subOrder.status === "PENDING" || subOrder.status === "CONFIRMED") {
                await prisma.order.update({ where: { id: subOrder.id }, data: { status: "CONFIRMED" } });
            }
        }
    } else {
        await prisma.order.update({ where: { id: order.id }, data: { payment_status: "PAID", payment_method: "RAZORPAY" } });
        if (order.status === "PENDING" || order.status === "CONFIRMED") {
            await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
        }
    }

    await transactionRepo.create({
      user_id: order.user_id,
      order_id: isMaster ? order.orders[0]?.id : order.id,
      payment_id: payment.id,
      type: "CREDIT",
      amount: amountPaid,
      status: "COMPLETED",
      description: \`Payment for order \${order.order_number}\`,
    });
  },

  `
);

fs.writeFileSync(path, code);
