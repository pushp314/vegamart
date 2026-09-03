const fs = require('fs');
const path = 'backend/src/services/delivery.service.ts';
let code = fs.readFileSync(path, 'utf8');

function replaceFunction(funcName, nextFuncName, replacementStr) {
    const startIdx = code.indexOf(`  async ${funcName}`);
    if (startIdx === -1) throw new Error(`Function ${funcName} not found`);
    const endIdx = code.indexOf(`  async ${nextFuncName}`);
    if (endIdx === -1) throw new Error(`Function ${nextFuncName} not found`);
    
    code = code.substring(0, startIdx) + replacementStr + '\n\n' + code.substring(endIdx);
}

// 1. listDeliveryRequests
const listDeliveryRequests = `  async listDeliveryRequests() {
    const rows = await prisma.masterOrder.findMany({
      where: {
        delivery_partner_id: null,
        orders: {
          some: {
            status: AVAILABLE_DELIVERY_REQUEST_FILTER,
            vendor: { is: { status: "APPROVED" } },
            AND: [
              { NOT: { delivery_note: { contains: "self", mode: "insensitive" } } },
              { NOT: { delivery_note: { contains: "pickup", mode: "insensitive" } } },
              { NOT: { delivery_note: { contains: "takeaway", mode: "insensitive" } } },
              { NOT: { delivery_note: { contains: "booking", mode: "insensitive" } } },
              { NOT: { delivery_note: { contains: "shop", mode: "insensitive" } } },
              { NOT: { delivery_note: { contains: "comes", mode: "insensitive" } } },
            ],
          }
        }
      },
      orderBy: { created_at: "asc" },
      take: 50,
      include: {
        customer: { select: { name: true, phone: true, avatar_url: true } },
        address: true,
        orders: {
          include: {
            vendor: { select: { id: true, business_name: true, latitude: true, longitude: true, phone: true } },
            items: true,
          }
        },
      }
    });

    return rows.map((m: any) => {
      const items = m.orders.flatMap((o: any) => o.items);
      const vendors = m.orders.map((o: any) => o.vendor);
      
      return {
        id: m.id,
        order_number: m.order_number,
        status: m.status,
        delivery_fee: m.delivery_fee,
        items_subtotal: m.total_amount,
        tax: m.tax,
        discount: 0,
        total: m.total_amount,
        delivery_note: m.orders[0]?.delivery_note,
        payment_method: m.payment_method,
        payment_status: m.payment_status,
        created_at: m.created_at,
        payment: null,
        items: items,
        vendor: vendors.length === 1 ? vendors[0] : { business_name: "Multiple Stores" },
        vendors: vendors,
        customer: m.customer,
        address: m.address,
      };
    });
  },`;
replaceFunction('listDeliveryRequests', 'listMyDeliveries', listDeliveryRequests);

// 2. listMyDeliveries
const listMyDeliveries = `  async listMyDeliveries(userId: string) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const rows = await prisma.masterOrder.findMany({
      where: { delivery_partner_id: partner.id },
      orderBy: { created_at: "desc" },
      include: {
        customer: { select: { name: true, phone: true, avatar_url: true } },
        address: true,
        orders: {
          include: {
            vendor: { select: { id: true, business_name: true, latitude: true, longitude: true, phone: true } },
            items: true,
            payment: { select: { amount: true, method: true, status: true, gateway_response: true } },
          }
        },
      }
    });

    return rows.map((m: any) => {
      const items = m.orders.flatMap((o: any) => o.items);
      const vendors = m.orders.map((o: any) => o.vendor);
      
      return {
        id: m.id,
        order_number: m.order_number,
        status: m.status,
        delivery_fee: m.delivery_fee,
        items_subtotal: m.total_amount,
        tax: m.tax,
        discount: 0,
        total: m.total_amount,
        delivery_note: m.orders[0]?.delivery_note,
        payment_method: m.payment_method,
        payment_status: m.payment_status,
        otp_code: m.orders[0]?.otp_code,
        created_at: m.created_at,
        payment: m.orders[0]?.payment,
        items: items,
        vendor: vendors.length === 1 ? vendors[0] : { business_name: "Multiple Stores" },
        vendors: vendors,
        customer: m.customer,
        address: m.address,
      };
    });
  },`;
replaceFunction('listMyDeliveries', 'acceptDelivery', listMyDeliveries);

// 3. acceptDelivery
const acceptDelivery = `  async acceptDelivery(
    userId: string,
    orderId: string,
    etaMinutes: number,
    req: Request,
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    if (partner.status !== "APPROVED") {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Delivery partner must be approved.",
        { code: "DELIVERY_NOT_APPROVED" },
      );
    }
    
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: {
        orders: true,
        customer: true
      }
    });
    
    if (!masterOrder) {
      throw new NotFoundError("Order not found.");
    }
    if (masterOrder.delivery_partner_id) {
      throw new ConflictError(
        "This order already has a delivery partner assigned.",
      );
    }
    
    const unacceptedOrders = masterOrder.orders.filter((o: any) => o.status === "PENDING");
    if (unacceptedOrders.length === masterOrder.orders.length) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Order has not been accepted by any vendor yet. Delivery partner can only accept orders after at least one vendor confirmation.",
        { code: "ORDER_NOT_ACCEPTED_BY_VENDOR" },
      );
    }
    
    // allow picking up unless order specifies self-pickup etc (if needed)
    
    if (
      requiresUpfrontPayment(masterOrder.payment_method) &&
      masterOrder.payment_status !== "PAID"
    ) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Order payment is not complete.",
        { code: "ORDER_PAYMENT_REQUIRED" },
      );
    }

    const claimWhere: Prisma.MasterOrderWhereInput = {
      id: orderId,
      delivery_partner_id: null,
      orders: {
        some: {
          status: ACCEPTABLE_DELIVERY_ASSIGNMENT_FILTER,
        }
      }
    };
    if (requiresUpfrontPayment(masterOrder.payment_method)) {
      claimWhere.payment_status = "PAID";
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const claimed = await tx.masterOrder.updateMany({
        where: claimWhere,
        data: { delivery_partner_id: partner.id },
      });
      if (claimed.count === 0) {
        throw new ConflictError(
          "This order already has a delivery partner assigned.",
        );
      }
      
      for (const order of masterOrder.orders) {
          if (ACCEPTABLE_DELIVERY_ASSIGNMENT_STATUSES.includes(order.status as any)) {
             await tx.order.update({
               where: { id: order.id },
               data: { delivery_partner_id: partner.id, eta_minutes: etaMinutes }
             });
             await tx.orderEvent.create({
                data: {
                  order_id: order.id,
                  status: order.status,
                  note: \`Delivery partner accepted the order. ETA: \${etaMinutes} mins.\`,
                  actor_type: "delivery",
                  actor_id: userId,
                },
             });
          }
      }
      return masterOrder;
    });

    if (!updated) {
      throw new NotFoundError("Order not found.");
    }
    
    for (const order of masterOrder.orders) {
       await prisma.deliveryTracking.upsert({
         where: { order_id: order.id },
         update: {},
         create: { order_id: order.id, status: "CONFIRMED" },
       });
    }

    await notificationService.orderStatus(
      masterOrder.user_id,
      masterOrder.order_number,
      "Delivery partner assigned",
      "A delivery partner has accepted your order.",
      { order_id: masterOrder.id },
    );
    
    await auditService.record(
      {
        userId,
        action: "ORDER_PLACED" as any, // fallback to a known audit action
        entityType: "masterOrder",
        entityId: orderId,
        newValues: { delivery_partner_id: partner.id },
      },
      req,
    );

    await this.updateDeliveryLocation(userId, {
      lat: partner.current_lat ?? 0,
      lng: partner.current_lng ?? 0,
      orderId: orderId,
    } as any);
  },`;
replaceFunction('acceptDelivery', 'updateDeliveryStatus', acceptDelivery);

// 4. updateDeliveryStatus
const updateDeliveryStatus = `  async updateDeliveryStatus(
    userId: string,
    orderId: string,
    input: DeliveryOrderStatusBody,
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    const statusInput = input.status;
    const note = (input as any).note;
    
    const status = statusInput.toUpperCase();

    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: { orders: true }
    });
    if (!masterOrder) {
      throw new NotFoundError("Order not found.");
    }
    if (masterOrder.delivery_partner_id !== partner.id) {
      throw new ForbiddenError("You are not assigned to this order.");
    }

    if (status === "OUT_FOR_DELIVERY" && masterOrder.orders.some((o: any) => o.status !== "READY_FOR_PICKUP" && o.status !== "OUT_FOR_DELIVERY")) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Cannot start delivery. All vendors have not marked the order as READY_FOR_PICKUP.",
        { code: "NOT_READY_FOR_PICKUP" },
      );
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.masterOrder.update({
        where: { id: orderId },
        data: { status: status as any },
      });
      
      for (const order of masterOrder.orders) {
         await tx.order.update({
           where: { id: order.id },
           data: { status: status as any },
         });
         await tx.orderEvent.create({
           data: {
             order_id: order.id,
             status: status as any,
             note: note || \`Status updated to \${status}\`,
             actor_type: "delivery",
             actor_id: userId,
           },
         });
         await tx.deliveryTracking.upsert({
           where: { order_id: order.id },
           update: { status: status as any },
           create: { order_id: order.id, status: status as any },
         });
      }
    });

    await notificationService.orderStatus(
      masterOrder.user_id,
      masterOrder.order_number,
      "Order status update",
      \`Your order is now \${status.replace(/_/g, " ").toLowerCase()}.\`,
      { order_id: orderId },
    );
  },`;
replaceFunction('updateDeliveryStatus', 'updateDeliveryLocation', updateDeliveryStatus);

// 5. updateDeliveryLocation
const updateDeliveryLocation = `  async updateDeliveryLocation(userId: string, input: DeliveryLocationBody & { orderId?: string }) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    await deliveryRepo.updateDelivery(partner.id, {
      current_lat: input.lat,
      current_lng: input.lng,
    });
    
    // We will find the active master orders if no explicit orderId
    const activeOrders = await prisma.order.findMany({
      where: {
        delivery_partner_id: partner.id,
        status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY"] },
      },
      select: { id: true, master_order_id: true },
    });
    
    for (const order of activeOrders) {
      await prisma.deliveryTracking.upsert({
        where: { order_id: order.id },
        update: { driver_lat: input.lat, driver_lng: input.lng },
        create: {
          order_id: order.id,
          status: "CONFIRMED",
          driver_lat: input.lat,
          driver_lng: input.lng,
        },
      });
      
    }
  },`;
replaceFunction('updateDeliveryLocation', 'markDelivered', updateDeliveryLocation);

// 6. markDelivered
const markDelivered = `  async markDelivered(
    userId: string,
    orderId: string,
    input: DeliveredOtpBody,
  ) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: { orders: { include: { vendor: true, items: true } } }
    });
    if (!masterOrder) {
      throw new NotFoundError("Order not found.");
    }
    if (masterOrder.delivery_partner_id !== partner.id) {
      throw new ForbiddenError("You are not assigned to this order.");
    }
    
    const firstOrder = masterOrder.orders[0];
    if (!firstOrder) throw new NotFoundError("Order has no sub-orders.");
    
    if (firstOrder.otp_code && firstOrder.otp_code !== input.otp) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid OTP.", {
        code: "INVALID_OTP",
      });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.masterOrder.update({
        where: { id: orderId },
        data: { status: "DELIVERED" }
      });
      for (const order of masterOrder.orders) {
         await tx.order.update({
           where: { id: order.id },
           data: {
             status: "DELIVERED",
             delivered_at: new Date(),
           },
         });
         await tx.orderEvent.create({
           data: {
             order_id: order.id,
             status: "DELIVERED",
             note: "Order delivered successfully.",
             actor_type: "delivery",
             actor_id: userId,
           },
         });
         await tx.deliveryTracking.updateMany({
           where: { order_id: order.id },
           data: { status: "DELIVERED" },
         });
      }
      
      const earningAmount = masterOrder.delivery_fee;
      await tx.deliveryEarning.create({
        data: {
          delivery_partner_id: partner.id,
          order_id: firstOrder.id,
          amount: earningAmount,
          type: "DELIVERY_FEE",
        },
      });

      await tx.transaction.create({
        data: {
          user_id: userId,
          amount: earningAmount,
          type: "CREDIT",
          status: "COMPLETED",
          reference: \`DELIVERY_FEE_\${firstOrder.order_number}\`,
        },
      });

      for (const order of masterOrder.orders) {
          const platformFeeRate = order.vendor?.commission_rate?.toNumber() ?? 10;
          const platformFee = (order.total.toNumber() * platformFeeRate) / 100;
          const vendorEarning = order.total.toNumber() - platformFee;

          await tx.vendorEarning.create({
            data: {
              vendor_id: order.vendor_id,
              order_id: order.id,
              amount: vendorEarning,
              platform_fee: platformFee,
            },
          });
          
          await tx.transaction.create({
            data: {
              user_id: order.vendor.user_id,
              amount: vendorEarning,
              type: "CREDIT",
              status: "COMPLETED",
              reference: \`ORDER_EARNING_\${order.order_number}\`,
            },
          });
      }
    });

    await notificationService.orderStatus(
      masterOrder.user_id,
      masterOrder.order_number,
      "Order delivered",
      "Your order has been delivered successfully. Enjoy!",
      { order_id: orderId },
    );
  },`;
replaceFunction('markDelivered', 'submitDeliveryKyc', markDelivered);

// 7. getDeliveryTracking
const getDeliveryTracking = `  async getDeliveryTracking(user: TrackingRequester, orderId: string) {
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: {
        orders: {
          include: { vendor: true }
        }
      }
    });

    if (!masterOrder) {
      throw new NotFoundError("Order not found.");
    }
    
    let canSeeDriverInfo = false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
       canSeeDriverInfo = true;
    } else if (user.role === "CUSTOMER") {
       if (masterOrder.user_id !== user.id) throw new ForbiddenError("You can only track your own orders.");
       canSeeDriverInfo = true;
    } else if (user.role === "DELIVERY") {
       const partner = await deliveryRepo.findByUserId(user.id);
       if (!partner || masterOrder.delivery_partner_id !== partner.id) throw new ForbiddenError("You are not assigned to this delivery.");
       canSeeDriverInfo = false;
    } else if (user.role === "VENDOR") {
       const vendor = await vendorRepo.findByUserId(user.id);
       if (!masterOrder.orders.some((o: any) => o.vendor_id === vendor?.id)) throw new ForbiddenError("You do not have access to this delivery.");
       canSeeDriverInfo = true;
    } else {
       throw new ForbiddenError("You do not have permission to track this delivery.");
    }

    const address = await addressRepo.findById(masterOrder.address_id);
    
    const firstOrder = masterOrder.orders[0];
    const tracking = firstOrder ? await prisma.deliveryTracking.findUnique({ where: { order_id: firstOrder.id } }) : null;
    
    let driverInfo = null;
    if (canSeeDriverInfo && masterOrder.delivery_partner_id) {
      const partner = await prisma.deliveryProfile.findUnique({
        where: { id: masterOrder.delivery_partner_id },
      });
      if (partner) {
        const driverUser = await userRepo.findById(partner.user_id, {});
        driverInfo = {
          name: driverUser?.name ?? "Delivery Partner",
          phone: driverUser?.phone ?? null,
          rating: partner.rating,
          review_count: partner.review_count,
          vehicle_type: partner.vehicle_type,
          vehicle_number: partner.vehicle_number,
        };
      }
    }
    
    const vendors = masterOrder.orders.map((o: any) => o.vendor);

    return {
      order_id: orderId,
      status: tracking?.status ?? masterOrder.status,
      current_lat: tracking?.driver_lat ?? null,
      current_lng: tracking?.driver_lng ?? null,
      heading: (tracking as any)?.heading ?? null,
      speed: (tracking as any)?.speed ?? null,
      eta_minutes: (tracking as any)?.eta_minutes ?? null,
      distance_km: (tracking as any)?.distance_km ?? null,
      last_updated_at: tracking?.updated_at ?? null,
      pickup_location: {
        lat: vendors[0]?.latitude ?? null,
        lng: vendors[0]?.longitude ?? null,
        address: vendors.length === 1 ? vendors[0]?.full_address : "Multiple Stores",
        name: vendors.length === 1 ? vendors[0]?.business_name : "Multiple Stores",
      },
      delivery_location: {
        lat: address?.latitude ?? null,
        lng: address?.longitude ?? null,
        address: address?.full_address ?? [address?.landmark, address?.city, address?.pincode].filter(Boolean).join(", "),
      },
      driver: driverInfo,
    };
  },`;
replaceFunction('getDeliveryTracking', 'getDeliveryWalletOverview', getDeliveryTracking);

fs.writeFileSync(path, code);
console.log('Restored master order fixes');
