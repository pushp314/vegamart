const fs = require('fs');
const path = 'backend/src/services/order.service.ts';
let code = fs.readFileSync(path, 'utf8');

const cancelOrderReplacement = `async cancelOrder(userId: string, orderId: string, input: { reason?: string }, req: Request): Promise<any> {
    const m = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: { orders: true }
    });

    if (m) {
      if (m.user_id !== userId) throw new ForbiddenError("You do not own this order.");
      if (m.status === "CANCELLED") return m;
      
      await prisma.$transaction(async (tx) => {
        await tx.masterOrder.update({ where: { id: m.id }, data: { status: "CANCELLED" } });
        for (const order of m.orders) {
            await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
            await tx.orderEvent.create({
              data: {
                order_id: order.id,
                status: "CANCELLED",
                note: input.reason || "Order cancelled by customer.",
                actor_type: "customer",
                actor_id: userId,
              },
            });
            const reservationItems = await tx.orderItem.findMany({ where: { order_id: order.id } });
            const toRelease = reservationItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity, name: item.product_name }));
            if (toRelease.length > 0) {
               await inventoryRepo.release(toRelease, tx);
            }
        }
      });
      // Trigger refund if paid
      if (m.payment_status === "PAID" && m.payment_method === "RAZORPAY") {
         const payment = await paymentRepo.findByMasterOrderId(m.id);
         if (payment) {
            await paymentService.processRefund(payment.id, m.total_amount.toNumber(), input.reason || "Customer Cancelled", req);
         }
      }
      return m;
    }

    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.user_id !== userId) {
      throw new ForbiddenError("You do not own this order.");
    }`;

code = code.replace(/async cancelOrder[\s\S]*?(?=if \(order.status === "CANCELLED"\))/, cancelOrderReplacement + '\n    ');

fs.writeFileSync(path, code);
