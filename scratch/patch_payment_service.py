import re

with open('backend/src/services/payment.service.ts', 'r') as f:
    code = f.read()

# Update verifyPayment
verify_target = '''    const order = await findOrderById(payment.order_id);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.user_id !== userId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }

    if (payment.status === "PAID") {
      return { payment, order };
    }'''

verify_replacement = '''    let order: any = null;
    let isMaster = false;
    if (payment.master_order_id) {
        order = await prisma.masterOrder.findUnique({ where: { id: payment.master_order_id }, include: { orders: true } });
        isMaster = true;
    } else if (payment.order_id) {
        order = await findOrderById(payment.order_id);
    }
    
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.user_id !== userId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }

    if (payment.status === "PAID") {
      return { payment, order };
    }'''

code = code.replace(verify_target, verify_replacement)

verify_end_target = '''    const updatedPayment = await paymentRepo.findByRazorpayOrderId(input.razorpay_order_id) ?? payment;
    await orderRepo.updateOrder(order.id, {
      payment_status: "PAID",
      payment_method: "RAZORPAY",
    });
    // Only a non-terminal order may be confirmed. If the order was cancelled or
    // otherwise left the confirmation flow while payment settled, the payment is
    // recorded as PAID but the order is never revived.
    if (order.status === "PENDING" || order.status === "CONFIRMED") {
      await orderRepo.updateOrderStatus(order.id, {
        status: "CONFIRMED",
        note: "Online Payment verified and completed successfully.",
        actorType: "system",
      });
    }

    const amountPaid = payment.amount.toNumber();
    await transactionRepo.create({
      user_id: userId,
      order_id: order.id,
      payment_id: payment.id,
      type: "CREDIT",
      amount: amountPaid,
      status: "COMPLETED",
      description: `Payment for order ${order.order_number}`,
    });'''

verify_end_replacement = '''    const updatedPayment = await paymentRepo.findByRazorpayOrderId(input.razorpay_order_id) ?? payment;
    
    if (isMaster) {
        await prisma.masterOrder.update({
            where: { id: order.id },
            data: { payment_status: "PAID", payment_method: "RAZORPAY", status: order.status === "PENDING" ? "ACCEPTED" : undefined }
        });
        
        for (const subOrder of order.orders) {
            await orderRepo.updateOrder(subOrder.id, { payment_status: "PAID", payment_method: "RAZORPAY" });
            if (subOrder.status === "PENDING" || subOrder.status === "CONFIRMED") {
                await orderRepo.updateOrderStatus(subOrder.id, { status: "CONFIRMED", note: "Online Payment verified and completed successfully.", actorType: "system" });
            }
        }
    } else {
        await orderRepo.updateOrder(order.id, { payment_status: "PAID", payment_method: "RAZORPAY" });
        if (order.status === "PENDING" || order.status === "CONFIRMED") {
            await orderRepo.updateOrderStatus(order.id, { status: "CONFIRMED", note: "Online Payment verified and completed successfully.", actorType: "system" });
        }
    }

    const amountPaid = payment.amount.toNumber();
    await transactionRepo.create({
      user_id: userId,
      order_id: isMaster ? undefined : order.id,
      payment_id: payment.id,
      type: "CREDIT",
      amount: amountPaid,
      status: "COMPLETED",
      description: `Payment for order ${order.order_number}`,
    });'''

code = code.replace(verify_end_target, verify_end_replacement)

# Update webhookRazorpay
webhook_target = '''    const order = await findOrderById(payment.order_id);
    if (!order) return;

    assertCapturedPayment(entity, payment);

    // Atomic claim: only one callback (webhook or client verify) applies the
    // paid transition; duplicates short-circuit before any side effect.
    const claimed = await paymentRepo.claimAsPaid(payment.id, {
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: signature,
      gateway_response: entity as never,
    });
    if (claimed === 0) return; // Already claimed

    await orderRepo.updateOrder(order.id, {
      payment_status: "PAID",
      payment_method: "RAZORPAY",
    });

    if (order.status === "PENDING" || order.status === "CONFIRMED") {
      await orderRepo.updateOrderStatus(order.id, {
        status: "CONFIRMED",
        note: "Online Payment verified successfully via webhook.",
        actorType: "system",
      });
    }

    const amountPaid = payment.amount.toNumber();
    await transactionRepo.create({
      user_id: order.user_id,
      order_id: order.id,
      payment_id: payment.id,
      type: "CREDIT",
      amount: amountPaid,
      status: "COMPLETED",
      description: `Payment for order ${order.order_number}`,
    });'''

webhook_replacement = '''    let order: any = null;
    let isMaster = false;
    if (payment.master_order_id) {
        order = await prisma.masterOrder.findUnique({ where: { id: payment.master_order_id }, include: { orders: true } });
        isMaster = true;
    } else if (payment.order_id) {
        order = await findOrderById(payment.order_id);
    }
    if (!order) return;

    assertCapturedPayment(entity, payment);

    const claimed = await paymentRepo.claimAsPaid(payment.id, {
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: signature,
      gateway_response: entity as never,
    });
    if (claimed === 0) return; // Already claimed
    
    if (isMaster) {
        await prisma.masterOrder.update({
            where: { id: order.id },
            data: { payment_status: "PAID", payment_method: "RAZORPAY", status: order.status === "PENDING" ? "ACCEPTED" : undefined }
        });
        
        for (const subOrder of order.orders) {
            await orderRepo.updateOrder(subOrder.id, { payment_status: "PAID", payment_method: "RAZORPAY" });
            if (subOrder.status === "PENDING" || subOrder.status === "CONFIRMED") {
                await orderRepo.updateOrderStatus(subOrder.id, { status: "CONFIRMED", note: "Online Payment verified successfully via webhook.", actorType: "system" });
            }
        }
    } else {
        await orderRepo.updateOrder(order.id, { payment_status: "PAID", payment_method: "RAZORPAY" });
        if (order.status === "PENDING" || order.status === "CONFIRMED") {
          await orderRepo.updateOrderStatus(order.id, {
            status: "CONFIRMED",
            note: "Online Payment verified successfully via webhook.",
            actorType: "system",
          });
        }
    }

    const amountPaid = payment.amount.toNumber();
    await transactionRepo.create({
      user_id: order.user_id,
      order_id: isMaster ? undefined : order.id,
      payment_id: payment.id,
      type: "CREDIT",
      amount: amountPaid,
      status: "COMPLETED",
      description: `Payment for order ${order.order_number}`,
    });'''

code = code.replace(webhook_target, webhook_replacement)

with open('backend/src/services/payment.service.ts', 'w') as f:
    f.write(code)

