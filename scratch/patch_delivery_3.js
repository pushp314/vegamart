const fs = require('fs');
const path = 'backend/src/services/delivery.service.ts';
let code = fs.readFileSync(path, 'utf8');

const markDeliveredReplacement = `async markDelivered(
    userId: string,
    input: { order_id: string; otp_code?: string },
    req: Request
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: input.order_id },
      include: { orders: { include: { vendor: true, items: true, transactions: true } } },
    });
    if (!masterOrder || masterOrder.delivery_partner_id !== partner.id) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You are not assigned to this master order.", { code: "FORBIDDEN" });
    }
    if (masterOrder.status !== "OUT_FOR_DELIVERY") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Master order is not out for delivery.");
    }

    // OTP Verification (from the first suborder since OTP is shared)
    const firstOrder = masterOrder.orders[0];
    if (firstOrder.otp_code) {
      if (!input.otp_code) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "Delivery OTP is required for this order.", {
          code: "OTP_REQUIRED",
        });
      }
      if (firstOrder.otp_attempts >= 5) {
        throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, "Maximum OTP verification attempts exceeded.", {
          code: "OTP_ATTEMPTS_EXCEEDED",
        });
      }
      if (firstOrder.otp_expires_at && firstOrder.otp_expires_at < new Date()) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "Delivery OTP has expired. Customer must regenerate.", {
          code: "OTP_EXPIRED",
        });
      }
      if (input.otp_code !== firstOrder.otp_code) {
        await prisma.order.updateMany({
           where: { master_order_id: masterOrder.id },
           data: { otp_attempts: { increment: 1 } }
        });
        throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid delivery OTP.", { code: "INVALID_OTP" });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.masterOrder.update({
        where: { id: masterOrder.id },
        data: { status: "DELIVERED" },
      });
      
      for (const order of masterOrder.orders) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "DELIVERED",
            delivered_at: new Date(),
            otp_code: null, // Clear OTP after successful use
          },
        });
        await tx.orderEvent.create({
          data: {
            order_id: order.id,
            status: "DELIVERED",
            note: "Order delivered successfully to the customer.",
            actor_type: "delivery",
            actor_id: userId,
          },
        });

        // Earning calculations
        const deliveryFee = order.delivery_fee.toNumber();
        if (deliveryFee > 0) {
          await tx.deliveryEarning.create({
            data: {
              delivery_partner_id: partner.id,
              order_id: order.id,
              amount: deliveryFee,
              type: "DELIVERY_FEE",
              status: "SETTLED",
              description: \`Delivery fee for order \${order.order_number}\`,
            },
          });
          await tx.deliveryProfile.update({
            where: { id: partner.id },
            data: { wallet_balance: { increment: deliveryFee }, total_earnings: { increment: deliveryFee } },
          });
        }

        // COD transaction handling for delivery boy
        if (order.payment_method === "COD" && order.payment_status === "PENDING") {
           await tx.order.update({ where: { id: order.id }, data: { payment_status: "PAID" } });
           const amountToCollect = order.total.toNumber();
           
           await tx.deliveryProfile.update({
             where: { id: partner.id },
             data: { cod_balance_due: { increment: amountToCollect } },
           });
           await tx.transaction.create({
             data: {
               user_id: userId,
               order_id: order.id,
               payment_id: "cod-delivery-collection",
               type: "DEBIT",
               amount: amountToCollect,
               status: "COMPLETED",
               reference: \`COD_\${order.order_number}\`,
               description: \`Cash collected for COD order \${order.order_number}\`,
             }
           });
           
           // Settle vendor COD earning via payout pool
           await tx.vendorEarning.create({
             data: {
               vendor_id: order.vendor_id,
               order_id: order.id,
               amount: order.total.toNumber() - order.delivery_fee.toNumber(),
               type: "ORDER_COMMISSION",
               status: "SETTLED",
               description: \`Earnings for COD order \${order.order_number} (Paid to Delivery Partner)\`,
               is_cod: true,
             }
           });
           await tx.vendorProfile.update({
             where: { id: order.vendor_id },
             data: { 
               wallet_balance: { increment: order.total.toNumber() - order.delivery_fee.toNumber() },
               total_earnings: { increment: order.total.toNumber() - order.delivery_fee.toNumber() }
             }
           });
        } else if (order.payment_method === "RAZORPAY") {
           // For online payments, earnings are already in the vendor's wallet
           // Wait, the vendor earning for online payment is settled in payoutService.settleVendorOrderEarnings.
           // Which is called in payment.service.ts for online payments.
        }
      }
    });

    if (masterOrder.user_id) {
      await notificationService.orderStatus(
        masterOrder.user_id,
        masterOrder.order_number,
        "Order Delivered",
        "Your order has been delivered successfully. Enjoy!",
        { order_id: masterOrder.id }
      );
    }
    
    for (const order of masterOrder.orders) {
       if (order.vendor?.user_id) {
         await notificationService.vendor(
           order.vendor.user_id,
           "Order Delivered",
           \`Order \${order.order_number} has been delivered to the customer.\`,
           { order_id: order.id }
         );
       }
    }

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.ORDER_DELIVERED, entityType: "master_order", entityId: masterOrder.id },
      req
    );

    return { success: true, message: "Order marked as delivered successfully." };
  },`;

code = code.replace(/async markDelivered[\s\S]*?(?=async submitDeliveryKyc)/, markDeliveredReplacement + '\n\n  ');

fs.writeFileSync(path, code);
