const fs = require('fs');
const path = 'backend/src/services/delivery.service.ts';
let code = fs.readFileSync(path, 'utf8');

// acceptDelivery replacement
const acceptDeliveryReplacement = `async acceptDelivery(
    userId: string,
    input: { order_id: string; location?: { lat: number; lng: number } },
    req: Request
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    if (partner.status !== "APPROVED") {
      throw new ApiError(HttpStatus.FORBIDDEN, "Your delivery account is not approved yet.", { code: "FORBIDDEN" });
    }

    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: input.order_id },
      include: { orders: { include: { vendor: true, customer: true } } },
    });

    if (!masterOrder) {
      throw new NotFoundError("Master order not found.");
    }
    if (masterOrder.delivery_partner_id) {
      throw new ApiError(HttpStatus.CONFLICT, "This master order has already been assigned to another partner.", {
        code: "ORDER_ALREADY_ASSIGNED",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.masterOrder.update({
        where: { id: masterOrder.id },
        data: {
          delivery_partner_id: partner.id,
          status: "PICKUP_IN_PROGRESS",
        },
      });

      for (const order of masterOrder.orders) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            delivery_partner_id: partner.id,
            status: "ACCEPTED",
            started_at: new Date(),
          },
        });
        await tx.orderEvent.create({
          data: {
            order_id: order.id,
            status: "ACCEPTED",
            note: "Delivery partner accepted the master order.",
            actor_type: "delivery",
            actor_id: userId,
          },
        });
      }
    });

    if (masterOrder.user_id) {
      await notificationService.orderStatus(
        masterOrder.user_id,
        masterOrder.order_number,
        "Delivery Partner Assigned",
        \`\${partner.user?.name || "A delivery partner"} has been assigned to your order.\`,
        { order_id: masterOrder.id }
      );
    }
    for (const order of masterOrder.orders) {
        if (order.vendor?.user_id) {
          await notificationService.vendor(
            order.vendor.user_id,
            "Delivery Partner Assigned",
            \`\${partner.user?.name || "A partner"} will pick up order \${order.order_number}.\`,
            { order_id: order.id }
          );
        }
    }

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.ORDER_ACCEPTED, entityType: "master_order", entityId: masterOrder.id },
      req
    );

    return { success: true, message: "Master order accepted successfully." };
  },`;

code = code.replace(/async acceptDelivery[\s\S]*?(?=async updateDeliveryStatus)/, acceptDeliveryReplacement + '\n\n  ');

// updateDeliveryStatus replacement
const updateDeliveryStatusReplacement = `async updateDeliveryStatus(
    userId: string,
    input: { order_id: string; status: MasterOrderStatus; note?: string },
    req: Request
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: input.order_id },
      include: { orders: { include: { vendor: true } }, customer: true },
    });
    if (!masterOrder || masterOrder.delivery_partner_id !== partner.id) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You are not assigned to this master order.", { code: "FORBIDDEN" });
    }

    // We only allow specific status transitions for MasterOrder in delivery app
    const validStatuses = ["PICKUP_IN_PROGRESS", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"];
    if (!validStatuses.includes(input.status)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, \`Invalid status transition to \${input.status}\`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.masterOrder.update({
        where: { id: masterOrder.id },
        data: { status: input.status as MasterOrderStatus },
      });
      
      const mappedOrderStatus = input.status === "PICKUP_IN_PROGRESS" ? "READY_FOR_PICKUP" : (input.status as OrderStatus);

      for (const order of masterOrder.orders) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: mappedOrderStatus },
        });
        await tx.orderEvent.create({
          data: {
            order_id: order.id,
            status: mappedOrderStatus,
            note: input.note || \`Master order status updated to \${input.status}\`,
            actor_type: "delivery",
            actor_id: userId,
          },
        });
      }
    });

    if (masterOrder.user_id && input.status === "OUT_FOR_DELIVERY") {
      await notificationService.orderStatus(
        masterOrder.user_id,
        masterOrder.order_number,
        "Order Out for Delivery",
        "Your order is out for delivery!",
        { order_id: masterOrder.id }
      );
    }
    
    // Vendor notification
    if (input.status === "OUT_FOR_DELIVERY") {
      for (const order of masterOrder.orders) {
        if (order.vendor?.user_id) {
          await notificationService.vendor(
            order.vendor.user_id,
            "Order Picked Up",
            \`Order \${order.order_number} has been picked up.\`,
            { order_id: order.id }
          );
        }
      }
    }

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.ORDER_UPDATED, entityType: "master_order", entityId: masterOrder.id, newValues: { status: input.status } },
      req
    );

    return { success: true, message: \`Master order status updated to \${input.status}.\` };
  },`;

code = code.replace(/async updateDeliveryStatus[\s\S]*?(?=async updateDeliveryLocation)/, updateDeliveryStatusReplacement + '\n\n  ');

fs.writeFileSync(path, code);
