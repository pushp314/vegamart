import { readFileSync, writeFileSync } from "fs";

let code = readFileSync("/Users/pushp/Desktop/vegamart/backend/src/services/payment.service.ts", "utf-8");

// We will inject a helper to resolve the order context
const helperCode = `
  async resolveOrderContext(orderId: string) {
    let order: any = await findOrderById(orderId);
    let isMasterOrder = false;
    if (!order) {
      const masterOrder = await findMasterOrderById(orderId);
      if (!masterOrder) {
        throw new NotFoundError("Order not found.");
      }
      order = masterOrder;
      isMasterOrder = true;
    }
    return {
      order,
      isMasterOrder,
      userIdOwner: order.user_id,
      paymentStatus: order.payment_status,
      orderStatus: order.status,
      orderNumber: order.order_number,
      orderTotal: isMasterOrder ? order.total_amount : order.total,
    };
  },
`;

code = code.replace("const paymentService = {", "const paymentService = {\n" + helperCode);

// Patch retryPayment
code = code.replace(
  /async retryPayment\(userId: string, orderId: string, _req: Request\) \{[\s\S]*?const existingPayment = await paymentRepo.findByOrderId\(order.id\);/m,
  `async retryPayment(userId: string, orderId: string, _req: Request) {
    const { order, isMasterOrder, userIdOwner, paymentStatus, orderStatus, orderNumber, orderTotal } = await this.resolveOrderContext(orderId);
    if (userIdOwner !== userId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }
    if (paymentStatus === "PAID") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "This order is already paid.", { code: "ALREADY_PAID" });
    }
    if (orderStatus === "CANCELLED") {
      if (isMasterOrder) {
        await updateMasterOrderStatus(order.id, "PENDING");
      } else {
        await orderRepo.updateOrderStatus(order.id, {
          status: "PENDING",
          note: "Customer retrying payment",
          actorType: "customer",
        });
      }
    }

    const existingPayment = isMasterOrder 
      ? await paymentRepo.findByMasterOrderId(order.id)
      : await paymentRepo.findByOrderId(order.id);`
);

// We need to also patch amountToCharge, order.order_number etc in retryPayment
code = code.replace(
  /const amountToCharge = Number\(existingPayment\?.amount && Number\(existingPayment.amount\) > 0 \? existingPayment.amount : order.total\);/g,
  `const amountToCharge = Number(existingPayment?.amount && Number(existingPayment.amount) > 0 ? existingPayment.amount : orderTotal);`
);

code = code.replace(/receipt: order.order_number,/g, `receipt: orderNumber,`);
code = code.replace(/order_number: order.order_number,/g, `order_number: orderNumber,`);

// Patch switchToCod
code = code.replace(
  /async switchToCod\(userId: string, orderId: string, _req: Request\) \{[\s\S]*?const existingPayment = await paymentRepo.findByOrderId\(order.id\);/m,
  `async switchToCod(userId: string, orderId: string, _req: Request) {
    const { order, isMasterOrder, userIdOwner, paymentStatus, orderStatus, orderNumber, orderTotal } = await this.resolveOrderContext(orderId);
    if (userIdOwner !== userId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }
    if (paymentStatus === "PAID") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "This order is already paid.", { code: "ALREADY_PAID" });
    }

    if (isMasterOrder) {
      await updateMasterOrderStatus(order.id, "PENDING");
      // Update payment method for all sub-orders
      for (const sub of order.orders) {
        await orderRepo.updateOrder(sub.id, {
          payment_method: "COD",
          payment_status: "PENDING",
          status: "PENDING",
        });
        await orderRepo.updateOrderStatus(sub.id, {
          status: "PENDING",
          note: "Switched to Cash on Delivery after online payment failure/cancellation.",
          actorType: "customer",
        });
      }
    } else {
      await orderRepo.updateOrder(order.id, {
        payment_method: "COD",
        payment_status: "PENDING",
        status: "PENDING",
      });
      await orderRepo.updateOrderStatus(order.id, {
        status: "PENDING",
        note: "Switched to Cash on Delivery after online payment failure/cancellation.",
        actorType: "customer",
      });
    }

    const existingPayment = isMasterOrder 
      ? await paymentRepo.findByMasterOrderId(order.id)
      : await paymentRepo.findByOrderId(order.id);`
);

code = code.replace(
  /order\.order_number/g,
  `orderNumber`
);
code = code.replace(
  /Number\(order\.total\)\.toFixed\(2\)/g,
  `Number(orderTotal).toFixed(2)`
);

// Patch recordPaymentFailure
code = code.replace(
  /async recordPaymentFailure\([\s\S]*?const order = await findOrderById\(orderId\);[\s\S]*?if \(!order\) \{[\s\S]*?throw new NotFoundError\("Order not found\."\);[\s\S]*?\}/m,
  `async recordPaymentFailure(
    userId: string,
    orderId: string,
    req: Request,
    metadata?: Record<string, any>
  ) {
    const { order, isMasterOrder, userIdOwner, orderNumber } = await this.resolveOrderContext(orderId);`
);

// Ensure we didn't miss fixing findByMasterOrderId since it requires payment to be "PAID"
// Wait! findByMasterOrderId only returns if status="PAID"!
