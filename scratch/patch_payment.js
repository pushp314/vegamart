const fs = require("fs");
let content = fs.readFileSync("/Users/pushp/Desktop/vegamart/backend/src/services/payment.service.ts", "utf-8");

content = content.replace(
  'import { findById as findOrderById } from "../repositories/order.repository";',
  'import { findById as findOrderById, findMasterOrderById, updateMasterOrderStatus } from "../repositories/order.repository";'
);

const helper = `
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

content = content.replace("const paymentService = {", "const paymentService = {\\n" + helper);

// retryPayment
const retryPaymentTarget = `  async retryPayment(userId: string, orderId: string, _req: Request) {
    const order = await findOrderById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.user_id !== userId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }
    if (order.payment_status === "PAID") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "This order is already paid.", { code: "ALREADY_PAID" });
    }
    if (order.status === "CANCELLED") {
      // Re-activate order to PENDING so customer can pay
      await orderRepo.updateOrderStatus(order.id, {
        status: "PENDING",
        note: "Customer retrying payment",
        actorType: "customer",
      });
    }

    const existingPayment = await paymentRepo.findByOrderId(order.id);
    const amountToCharge = Number(existingPayment?.amount && Number(existingPayment.amount) > 0 ? existingPayment.amount : order.total);
    const amountPaise = Math.max(100, Math.round(amountToCharge * 100)); // minimum 1 INR for Razorpay

    const gatewayOrder = await razorpayGateway.createOrder({
      amountPaise,
      currency: "INR",
      receipt: order.order_number,
      notes: {
        order_number: order.order_number,
        user_id: userId,
        retry: "true",
      },
    });`;

const retryPaymentReplacement = `  async retryPayment(userId: string, orderId: string, _req: Request) {
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
      : await paymentRepo.findByOrderId(order.id);
      
    const amountToCharge = Number(existingPayment?.amount && Number(existingPayment.amount) > 0 ? existingPayment.amount : orderTotal);
    const amountPaise = Math.max(100, Math.round(amountToCharge * 100)); // minimum 1 INR for Razorpay

    const gatewayOrder = await razorpayGateway.createOrder({
      amountPaise,
      currency: "INR",
      receipt: orderNumber,
      notes: {
        order_number: orderNumber,
        user_id: userId,
        retry: "true",
      },
    });`;

content = content.replace(retryPaymentTarget, retryPaymentReplacement);

// switchToCod
const switchToCodTarget = `  async switchToCod(userId: string, orderId: string, _req: Request) {
    const order = await findOrderById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.user_id !== userId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }
    if (order.payment_status === "PAID") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "This order is already paid.", { code: "ALREADY_PAID" });
    }

    // Switch payment method to COD and set order status to PENDING
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

    const existingPayment = await paymentRepo.findByOrderId(order.id);`;

const switchToCodReplacement = `  async switchToCod(userId: string, orderId: string, _req: Request) {
    const { order, isMasterOrder, userIdOwner, paymentStatus, orderNumber, orderTotal } = await this.resolveOrderContext(orderId);
    
    if (userIdOwner !== userId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not own this order.", { code: "FORBIDDEN" });
    }
    if (paymentStatus === "PAID") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "This order is already paid.", { code: "ALREADY_PAID" });
    }

    if (isMasterOrder) {
      await updateMasterOrderStatus(order.id, "PENDING");
      if (order.orders) {
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
      : await paymentRepo.findByOrderId(order.id);`;

content = content.replace(switchToCodTarget, switchToCodReplacement);

content = content.replace(/notificationService.orderStatus\\(\n\s*userId,\n\s*order\.order_number,\n\s*"Switched to Cash on Delivery 💵",\n\s*\`Your order #\$\{order\.order_number\} has been switched to Cash on Delivery\. Please pay ₹\$\{Number\\(order\.total\\)\.toFixed\\(2\\)\} when your order arrives\.\`,\n\s*\{ order_id: order\.id \}\n\s*\\);/g, 
\`notificationService.orderStatus(
      userId,
      orderNumber,
      "Switched to Cash on Delivery 💵",
      \\\`Your order #\${orderNumber} has been switched to Cash on Delivery. Please pay ₹\${Number(orderTotal).toFixed(2)} when your order arrives.\\\`,
      { order_id: isMasterOrder ? order.orders?.[0]?.id : order.id }
    );\`);

// recordPaymentFailure
const recordFailureTarget = `  async recordPaymentFailure(
    userId: string,
    orderId: string,
    input: { reason?: string; error_code?: string; error_description?: string },
    _req: Request
  ) {
    const order = await findOrderById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.user_id !== userId) {`;

const recordFailureReplacement = `  async recordPaymentFailure(
    userId: string,
    orderId: string,
    input: { reason?: string; error_code?: string; error_description?: string },
    _req: Request
  ) {
    const { order, isMasterOrder, userIdOwner, orderNumber } = await this.resolveOrderContext(orderId);
    if (userIdOwner !== userId) {`;

content = content.replace(recordFailureTarget, recordFailureReplacement);

fs.writeFileSync("/Users/pushp/Desktop/vegamart/backend/src/services/payment.service.ts", content);
