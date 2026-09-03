const fs = require('fs');
const path = 'backend/src/services/payment.service.ts';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('import prisma from')) {
    code = code.replace('import { paymentRepo }', 'import prisma from "../database/prisma";\nimport { paymentRepo }');
}

// Replace the verifyPayment body entirely
code = code.replace(
  /async verifyPayment[\s\S]*?(?=async handleWebhook)/,
  `async verifyPayment(userId: string, input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }, req: Request) {
    const payment = await paymentRepo.findByRazorpayOrderId(input.razorpay_order_id);
    if (!payment) {
      throw new NotFoundError("Payment not found.");
    }

    let order: any = null;
    let isMaster = false;
    if (payment.master_order_id) {
        order = await prisma.masterOrder.findUnique({ where: { id: payment.master_order_id }, include: { orders: { include: { vendor: true, items: true, customer: true } } } });
        isMaster = true;
    } else if (payment.order_id) {
        order = await prisma.order.findUnique({ where: { id: payment.order_id }, include: { vendor: true, items: true, customer: true } });
    }
    
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.user_id !== userId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }

    if (payment.status === "PAID") {
      return { payment, order };
    }

    const valid = razorpayGateway.verifySignature({
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });
    if (!valid) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid payment signature.", { code: "INVALID_SIGNATURE" });
    }

    let entity: any;
    try {
      entity = await razorpayGateway.fetchPayment(input.razorpay_payment_id);
    } catch {
      throw new ApiError(HttpStatus.BAD_GATEWAY, "Unable to verify payment with the payment gateway.", {
        code: "PAYMENT_VERIFICATION_FAILED",
      });
    }

    assertCapturedPayment(entity, payment);

    const claimed = await paymentRepo.claimAsPaid(payment.id, {
      razorpay_payment_id: input.razorpay_payment_id,
      razorpay_signature: input.razorpay_signature,
      gateway_response: entity as never,
    });
    if (claimed === 0) {
      const paidPayment = await paymentRepo.findByRazorpayOrderId(input.razorpay_order_id);
      return { payment: paidPayment ?? payment, order };
    }

    const updatedPayment = await paymentRepo.findByRazorpayOrderId(input.razorpay_order_id) ?? payment;
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
            // notification logic for suborder
            if (subOrder.vendor?.user_id) {
               await realtime.publishVendorOrder(subOrder.vendor_id, {
                 order_id: subOrder.id,
                 order_number: subOrder.order_number,
                 total: Number(subOrder.total),
                 items_count: subOrder.items?.length ?? 0,
                 customer_name: subOrder.customer?.name ?? undefined,
                 customer_phone: subOrder.customer?.phone ?? undefined,
                 payment_method: "RAZORPAY",
                 items: subOrder.items?.map((it: any) => ({
                   name: it.product_name,
                   quantity: it.quantity,
                   price: Number(it.total_price),
                 })) || [],
                 created_at: new Date().toISOString(),
               });
            }
        }
    } else {
        await prisma.order.update({ where: { id: order.id }, data: { payment_status: "PAID", payment_method: "RAZORPAY" } });
        if (order.status === "PENDING" || order.status === "CONFIRMED") {
            await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
        }
    }

    await transactionRepo.create({
      order_id: isMaster ? order.orders[0].id : order.id,
      payment_id: payment.id,
      user_id: userId,
      type: "DEBIT",
      amount: amountPaid,
      status: "success",
      reference: input.razorpay_payment_id,
      metadata: { razorpay_order_id: input.razorpay_order_id },
    });

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.PAYMENT_VERIFIED, entityType: "payment", entityId: payment.id, newValues: { razorpay_payment_id: input.razorpay_payment_id, order_id: order.id, amount: amountPaid } },
      req
    );

    return { payment: updatedPayment, order };
  },

  `
);

code = code.replace(
  /async webhookRazorpay[\s\S]*?(?=async initiateRefund)/,
  `async webhookRazorpay(payload: any, signature: string): Promise<boolean> {
    const razorpayPaymentId = payload.payload?.payment?.entity?.id;
    const razorpayOrderId = payload.payload?.payment?.entity?.order_id;
    const entity = payload.payload?.payment?.entity;
    
    if (!razorpayOrderId || !razorpayPaymentId) return false;

    const payment = await paymentRepo.findByRazorpayOrderId(razorpayOrderId);
    if (!payment) return true;

    let order: any = null;
    let isMaster = false;
    if (payment.master_order_id) {
        order = await prisma.masterOrder.findUnique({ where: { id: payment.master_order_id }, include: { orders: true } });
        isMaster = true;
    } else if (payment.order_id) {
        order = await prisma.order.findUnique({ where: { id: payment.order_id } });
    }
    if (!order) return true;

    assertCapturedPayment(entity, payment);

    const claimed = await paymentRepo.claimAsPaid(payment.id, {
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: signature,
      gateway_response: entity as never,
    });
    if (claimed === 0) return true;

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
      order_id: isMaster ? order.orders[0].id : order.id,
      payment_id: payment.id,
      type: "CREDIT",
      amount: amountPaid,
      status: "COMPLETED",
      description: \`Payment for order \${order.order_number}\`,
    });
    
    return true;
  },

  `
);

fs.writeFileSync(path, code);
