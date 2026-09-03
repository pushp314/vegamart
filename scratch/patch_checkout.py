import re
import sys

with open("backend/src/services/checkout.service.ts", "r") as f:
    code = f.read()

place_order_regex = re.compile(r'async placeOrder\(userId: string, input: PlaceOrderBody, req: Request\): Promise<CheckoutResult> \{([\s\S]*?)async placeOrderWithVerifiedPayment', re.MULTILINE)
place_order_verified_regex = re.compile(r'async placeOrderWithVerifiedPayment\([\s\S]*?\): Promise<CheckoutResult> \{([\s\S]*?)\n\};', re.MULTILINE)

new_place_order = r"""
    const cart = await cartService.getMyCart(userId);
    const groups = groupByVendor(cart);
    const summary = await this.buildSummary(cart, groups, input, userId);

    for (const group of summary.groups) {
      if (group.items_subtotal < group.min_order) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          `Minimum order for ${group.vendor_name} is ₹${group.min_order}. Please add more items.`,
          { code: "MIN_ORDER_NOT_MET" }
        );
      }
    }

    const address = await findAddressById(input.address_id);
    if (!address || address.user_id !== userId || address.deleted_at) {
      throw new NotFoundError("Address not found.");
    }

    const slotRaw = (input.delivery_slot || "").toLowerCase();
    const isPickup = slotRaw.includes("self") || slotRaw.includes("pickup") || slotRaw.includes("takeaway");

    if (!isPickup && address.latitude && address.longitude) {
      for (const group of summary.groups) {
        const vendor = await findVendorById(group.vendor_id);
        if (vendor && vendor.latitude && vendor.longitude) {
          const distKm = haversineDistanceKm(
            Number(address.latitude),
            Number(address.longitude),
            Number(vendor.latitude),
            Number(vendor.longitude)
          );
          const maxRadius = Number(vendor.delivery_radius_km || 5);
          if (distKm > maxRadius) {
            throw new ApiError(
              HttpStatus.BAD_REQUEST,
              `Selected delivery address in ${address.city || address.full_address || "selected area"} is ${distKm.toFixed(1)} km away. ${vendor.business_name} only delivers within ${maxRadius} km. Please choose a closer address or select Self Pickup.`,
              {
                code: "OUT_OF_DELIVERY_RADIUS",
                details: { distance_km: String(Math.round(distKm * 10) / 10), max_radius_km: String(maxRadius), vendor_name: vendor.business_name, address_city: address.city || "" },
              }
            );
          }
        }
      }
    }

    const idempotencyKey = input.idempotency_key ?? undefined;
    const paymentMethod = input.payment_method ?? "RAZORPAY";
    const paymentType = input.payment_type ?? "FULL";
    const requestHash = idempotencyKey ? computeRequestHash(userId, input, summary) : null;

    for (const group of summary.groups) {
      if (group.delivery_configs) {
        const deliveryInfo = getDeliveryOptionConfig(input.delivery_slot, group.delivery_configs);
        const optConfig = deliveryInfo.config;
        if (!optConfig.enabled) throw new ApiError(HttpStatus.BAD_REQUEST, `${group.vendor_name} does not offer ${deliveryInfo.name} at this time.`, { code: "DELIVERY_OPTION_DISABLED" });
        if (paymentMethod === "COD" && !optConfig.cod_enabled) throw new ApiError(HttpStatus.BAD_REQUEST, `Cash on Delivery/Pickup is disabled for ${deliveryInfo.name}.`, { code: "COD_NOT_ALLOWED" });
        if (paymentMethod === "RAZORPAY" && !optConfig.online_payment_enabled) throw new ApiError(HttpStatus.BAD_REQUEST, `Online payment is disabled for ${deliveryInfo.name}.`, { code: "ONLINE_PAYMENT_NOT_ALLOWED" });
        if (!optConfig.online_payment_enabled && !optConfig.cod_enabled) throw new ApiError(HttpStatus.BAD_REQUEST, `No payment methods are available for ${deliveryInfo.name}.`, { code: "PAYMENT_UNAVAILABLE" });
        if (paymentType === "ADVANCE" && !optConfig.advance_payment_enabled) throw new ApiError(HttpStatus.BAD_REQUEST, `Advance payment is not available for ${deliveryInfo.name}.`, { code: "ADVANCE_PAYMENT_NOT_ALLOWED" });
        if (paymentType === "FULL" && !optConfig.full_payment_enabled && optConfig.advance_payment_enabled) throw new ApiError(HttpStatus.BAD_REQUEST, `Full payment is disabled for ${deliveryInfo.name}.`, { code: "FULL_PAYMENT_NOT_ALLOWED" });
      }
    }

    if (idempotencyKey) {
      const existing = await checkoutIdempotencyRepo.findByKey(idempotencyKey, userId);
      if (existing) {
        if (existing.request_hash && existing.request_hash !== requestHash) throw new ApiError(HttpStatus.CONFLICT, "Idempotency key was already used for a different request.", { code: "IDEMPOTENCY_REUSE_CONFLICT" });
        if (!existing.response) throw new ApiError(HttpStatus.CONFLICT, "A checkout with this idempotency key is already in progress. Please retry.", { code: "IDEMPOTENCY_IN_PROGRESS" });
        return existing.response as unknown as CheckoutResult;
      }
    }

    const computations = summary.groups.map((group, idx) => {
      const groupSubtotal = group.items_subtotal;
      const groupDiscount = Math.round((summary.group_discounts?.[group.vendor_id] ?? 0) * 100) / 100;
      const discountRatio = groupSubtotal > 0 ? groupDiscount / groupSubtotal : 0;
      let groupTaxRaw = 0;
      for (const item of group.items) {
        const itemDiscount = item.line_total * discountRatio;
        const itemTaxable = Math.max(0, item.line_total - itemDiscount);
        groupTaxRaw += (itemTaxable * (item.tax_rate ?? 0)) / 100;
      }
      const groupTax = Math.round(groupTaxRaw * 100) / 100;
      const effectiveDeliveryFee = summary.is_consolidated_delivery ? (idx === 0 ? summary.delivery_fee : 0) : group.delivery_fee;
      const groupTotal = Math.round((groupSubtotal + effectiveDeliveryFee - groupDiscount + groupTax) * 100) / 100;
      return { group: { ...group, delivery_fee: effectiveDeliveryFee }, groupDiscount, groupTax, groupTotal, orderNumber: generateOrderNumber() };
    });

    const dailyLimits = await Promise.all(computations.map((c) => membershipPlanService.getMyMembership(c.group.vendor_id).then((m) => m?.plan?.daily_order_limit ?? 5).catch(() => 5)));

    let masterAmountToCharge = summary.total;
    if (summary.groups.length === 1 && summary.groups[0]?.delivery_configs) {
       const configs = summary.groups[0].delivery_configs;
       if (configs) {
         const deliveryInfo = getDeliveryOptionConfig(input.delivery_slot, configs);
         const optConfig = deliveryInfo.config;
         if (paymentMethod === "RAZORPAY" && paymentType === "ADVANCE" && optConfig.advance_payment_enabled) {
           const advancePct = optConfig.advance_percentage || 20;
           masterAmountToCharge = advancePct <= 0 || advancePct >= 100 ? summary.total : Math.max(1, Math.round(summary.total * (advancePct / 100) * 100) / 100);
         }
       }
    }
    if (masterAmountToCharge > 0 && masterAmountToCharge < 1) { masterAmountToCharge = 1; }

    const masterOrderNumber = generateOrderNumber();
    let gatewayOrder;
    if (paymentMethod === "RAZORPAY" && masterAmountToCharge > 0) {
        gatewayOrder = await razorpayGateway.createOrder({
            amountPaise: Math.round(masterAmountToCharge * 100),
            currency: DEFAULT_CURRENCY,
            receipt: masterOrderNumber,
            notes: { order_number: masterOrderNumber, user_id: userId, delivery_slot: input.delivery_slot || "", payment_type: paymentType }
        });
    }

    const serializedOrders: Array<{ order: SerializedOrder; payment: SerializedPayment }> = [];

    try {
      await prisma.$transaction(async (tx) => {
        if (idempotencyKey) {
          await checkoutIdempotencyRepo.create(tx, { idempotency_key: idempotencyKey, user_id: userId, request_hash: requestHash as string });
        }

        const masterOrder = await tx.masterOrder.create({
            data: {
                order_number: masterOrderNumber,
                user_id: userId,
                address_id: address.id,
                total_amount: summary.total,
                delivery_fee: summary.delivery_fee,
                tax: summary.tax,
                status: "PENDING",
                payment_method: paymentMethod,
                payment_status: "PENDING",
            }
        });

        const sharedOtp = generateDeliveryOtp();

        for (let i = 0; i < computations.length; i++) {
          const { group, groupDiscount, groupTax, groupTotal, orderNumber } = computations[i]!;

          const order = await orderRepo.createOrder({
            order_number: orderNumber,
            master_order_id: masterOrder.id,
            user_id: userId,
            vendor_id: group.vendor_id,
            address_id: address.id,
            coupon_id: summary.coupon?.id ?? null,
            coupon_discount: 0,
            items_subtotal: group.items_subtotal,
            delivery_fee: group.delivery_fee,
            tax: 0,
            total: 0,
            payment_method: paymentMethod,
            delivery_note: input.delivery_slot || "Standard Delivery",
            items: group.items.map((item) => ({ product_id: item.product_id, product_name: item.name, unit: item.unit, selected_unit: item.selected_unit, quantity: item.quantity, unit_price: item.unit_price, total_price: item.line_total, image_url: item.image_url ?? null })),
          }, tx);

          const updated = await orderRepo.updateOrder(order.id, { discount: groupDiscount, tax: groupTax, total: groupTotal, invoice_number: generateInvoiceNumber(orderNumber), otp_code: sharedOtp, otp_expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000) }, tx);
          await orderRepo.updateOrderStatus(order.id, { status: "PENDING", note: "Order placed. Awaiting payment confirmation.", actorType: "customer", actorId: userId }, tx);
          
          const counter = await dailyOrderCounterRepo.incrementForVendor(group.vendor_id, startOfToday(), dailyLimits[i] ?? 5, tx);
          if (counter === null) throw new ApiError(HttpStatus.FORBIDDEN, "Vendor is currently busy and has reached their daily order limit.", { code: "DAILY_ORDER_LIMIT_REACHED" });

          serializedOrders.push(serializeOrder(updated, {} as any));
        }

        let payment;
        if (paymentMethod === "RAZORPAY") {
          payment = await paymentRepo.createForOrder({
             master_order_id: masterOrder.id,
             amount: masterAmountToCharge,
             method: "RAZORPAY",
             razorpay_order_id: gatewayOrder?.id,
          }, tx);
        } else {
          payment = await paymentRepo.createForOrder({
             master_order_id: masterOrder.id,
             amount: summary.total,
             method: "COD",
          }, tx);
        }

        for (let i = 0; i < serializedOrders.length; i++) {
            serializedOrders[i].payment = serializePayment(payment);
        }

        const reservationItems = computations.flatMap((c) => c.group.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity, name: item.name })));
        await inventoryRepo.reserveAvailable(reservationItems, tx);

        if (summary.coupon) {
          const firstOrderId = serializedOrders[0]?.order.id;
          if (firstOrderId) await couponRepo.claimUsage(summary.coupon.id, firstOrderId, userId, summary.discount, tx);
        }

        if (idempotencyKey) {
          await checkoutIdempotencyRepo.updateResponse(idempotencyKey, { summary, orders: serializedOrders } as any, tx);
        }
      });
    } catch (error: any) {
      log.error(`[placeOrder] Transaction failed: ${error.message}`);
      if (idempotencyKey && error.code !== "IDEMPOTENCY_REUSE_CONFLICT" && error.code !== "IDEMPOTENCY_IN_PROGRESS") {
         await checkoutIdempotencyRepo.clear(idempotencyKey);
      }
      throw error;
    }

    await cartRepo.clear(cart.id);

    for (let i = 0; i < computations.length; i++) {
      const { group, groupTotal } = computations[i]!;
      const entry = serializedOrders[i];
      if (!entry) continue;

      for (const item of group.items) {
        productRepo.findById(item.product_id).then((product) => {
          if (product) realtime.publishShopProductUpdate(group.vendor_id, item.product_id, { stock: product.stock, is_available: product.is_available });
        }).catch(() => {});
      }

      const vendor = await findVendorById(group.vendor_id);
      if (vendor && paymentMethod === "COD") {
        await notificationService.vendor(vendor.user_id, "New COD Order Received! 🛒", `Order #${entry.order.order_number} received via COD (${group.items.length} items, ₹${groupTotal}).`, { order_id: entry.order.id, order_number: entry.order.order_number, total: groupTotal, payment_method: "COD" });
        realtime.publishVendorOrder(group.vendor_id, { order_id: entry.order.id, order_number: entry.order.order_number, total: groupTotal, items_count: group.items.length, payment_method: "COD", items: group.items.map((it) => ({ name: it.name, quantity: it.quantity, price: it.unit_price })), created_at: new Date().toISOString() });
      }
    }

    await auditService.record({ userId, action: AUDIT_ACTIONS.ORDER_PLACED, entityType: "order", entityId: serializedOrders.map((o) => o.order.id).join(","), newValues: { count: serializedOrders.length, total: summary.total, payment_method: paymentMethod } }, req);
    return { summary, orders: serializedOrders };
"""

new_place_order_verified = r"""
    const cart = await cartRepo.getOrCreate(userId);
    await cartRepo.clear(cart.id);
    for (const item of input.items) {
      await cartService.addItem(userId, { product_id: item.product_id, quantity: item.quantity, selected_unit: item.selected_unit }, req);
    }

    const currentCart = await cartService.getMyCart(userId);
    const groups = groupByVendor(currentCart);
    const summary = await this.buildSummary(currentCart, groups, input, userId);

    const address = await findAddressById(input.address_id);
    if (!address || address.user_id !== userId || address.deleted_at) throw new NotFoundError("Address not found.");

    const paymentType = input.payment_type ?? "FULL";
    const groupDiscounts = summary.group_discounts;
    const computations = summary.groups.map((group, idx) => {
      const groupDiscount = groupDiscounts[group.vendor_id] ?? 0;
      const discountRatio = group.items_subtotal > 0 ? groupDiscount / group.items_subtotal : 0;
      const groupSubtotal = group.items_subtotal;
      let groupTaxRaw = 0;
      for (const item of group.items) {
        const itemDiscount = item.line_total * discountRatio;
        const itemTaxable = Math.max(0, item.line_total - itemDiscount);
        groupTaxRaw += (itemTaxable * (item.tax_rate ?? 0)) / 100;
      }
      const groupTax = Math.round(groupTaxRaw * 100) / 100;
      const effectiveDeliveryFee = summary.is_consolidated_delivery ? (idx === 0 ? summary.delivery_fee : 0) : group.delivery_fee;
      const groupTotal = Math.round((groupSubtotal + effectiveDeliveryFee - groupDiscount + groupTax) * 100) / 100;
      return { group: { ...group, delivery_fee: effectiveDeliveryFee }, groupDiscount, groupTax, groupTotal, orderNumber: generateOrderNumber() };
    });

    const serializedOrders: Array<{ order: SerializedOrder; payment: SerializedPayment }> = [];
    const masterOrderNumber = generateOrderNumber();

    let masterAmountToCharge = summary.total;
    if (summary.groups.length === 1 && summary.groups[0]?.delivery_configs) {
       const configs = summary.groups[0].delivery_configs;
       if (configs) {
         const deliveryInfo = getDeliveryOptionConfig(input.delivery_slot, configs);
         const optConfig = deliveryInfo.config;
         if (paymentType === "ADVANCE" && optConfig.advance_payment_enabled) {
           const advancePct = optConfig.advance_percentage || 20;
           masterAmountToCharge = advancePct <= 0 || advancePct >= 100 ? summary.total : Math.max(1, Math.round(summary.total * (advancePct / 100) * 100) / 100);
         }
       }
    }
    if (masterAmountToCharge > 0 && masterAmountToCharge < 1) { masterAmountToCharge = 1; }

    await prisma.$transaction(async (tx) => {
      const masterOrder = await tx.masterOrder.create({
          data: {
              order_number: masterOrderNumber,
              user_id: userId,
              address_id: address.id,
              total_amount: summary.total,
              delivery_fee: summary.delivery_fee,
              tax: summary.tax,
              status: "ACCEPTED",
              payment_method: "RAZORPAY",
              payment_status: "PAID",
          }
      });

      const sharedOtp = generateDeliveryOtp();

      for (let i = 0; i < computations.length; i++) {
        const { group, groupDiscount, groupTax, groupTotal, orderNumber } = computations[i]!;

        const order = await orderRepo.createOrder({
          order_number: orderNumber,
          master_order_id: masterOrder.id,
          user_id: userId,
          vendor_id: group.vendor_id,
          address_id: address.id,
          coupon_id: summary.coupon?.id ?? null,
          coupon_discount: groupDiscount,
          items_subtotal: group.items_subtotal,
          delivery_fee: group.delivery_fee,
          tax: groupTax,
          total: groupTotal,
          payment_method: "RAZORPAY",
          delivery_note: input.delivery_slot ?? null,
          items: group.items.map((item) => ({ product_id: item.product_id, product_name: item.name, unit: item.unit, selected_unit: item.selected_unit, quantity: item.quantity, unit_price: item.unit_price, total_price: item.line_total, image_url: item.image_url ?? null })),
        }, tx);

        const updated = await orderRepo.updateOrder(order.id, { discount: groupDiscount, tax: groupTax, total: groupTotal, invoice_number: generateInvoiceNumber(orderNumber), otp_code: sharedOtp, otp_expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000) }, tx);
        await dailyOrderCounterRepo.incrementForVendor(group.vendor_id, startOfToday(), 50, tx);

        serializedOrders.push(serializeOrder(updated, {} as any));
      }

      const paymentRecord = await paymentRepo.createForOrder({
         master_order_id: masterOrder.id,
         amount: masterAmountToCharge,
         method: "RAZORPAY",
         razorpay_order_id: verifiedPayment.razorpay_order_id,
      }, tx);

      await paymentRepo.claimAsPaid(paymentRecord.id, { razorpay_payment_id: verifiedPayment.razorpay_payment_id, razorpay_signature: verifiedPayment.razorpay_signature });

      for (let i = 0; i < serializedOrders.length; i++) {
          serializedOrders[i].payment = serializePayment({ ...paymentRecord, status: "PAID" } as any);
      }

      const reservationItems = computations.flatMap((c) => c.group.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity, name: item.name })));
      await inventoryRepo.reserveAvailable(reservationItems, tx);

      if (summary.coupon) {
        const firstOrderId = serializedOrders[0]?.order.id;
        if (firstOrderId) await couponRepo.claimUsage(summary.coupon.id, firstOrderId, userId, summary.discount, tx);
      }
    });

    await cartRepo.clear(cart.id);

    for (let i = 0; i < computations.length; i++) {
      const { group, groupTotal } = computations[i]!;
      const entry = serializedOrders[i];
      if (!entry) continue;

      for (const item of group.items) {
        productRepo.findById(item.product_id).then((product) => {
          if (product) realtime.publishShopProductUpdate(group.vendor_id, item.product_id, { stock: product.stock, is_available: product.is_available });
        }).catch(() => {});
      }

      await notificationService.orderStatus(userId, entry.order.order_number, "Order Confirmed & Paid", `Your order ${entry.order.order_number} has been placed and paid successfully (₹${groupTotal}).`, { order_id: entry.order.id });

      const vendor = await findVendorById(group.vendor_id);
      if (vendor) {
        const customerName = (req.user as any)?.name || address?.label || "Customer";
        const customerPhone = address?.phone || (req.user as any)?.phone || undefined;
        await notificationService.vendor(vendor.user_id, "New Paid Order Received! 🛒", `Order #${entry.order.order_number} has been paid online (${group.items.length} items, ₹${groupTotal}).`, { order_id: entry.order.id, order_number: entry.order.order_number, total: groupTotal, customer_name: customerName, payment_method: "RAZORPAY" });
        realtime.publishVendorOrder(group.vendor_id, { order_id: entry.order.id, order_number: entry.order.order_number, total: groupTotal, items_count: group.items.length, customer_name: customerName, customer_phone: customerPhone, payment_method: "RAZORPAY", items: group.items.map((it) => ({ name: it.name, quantity: it.quantity, price: it.unit_price })), created_at: new Date().toISOString() });
      }
    }

    await auditService.record({ userId, action: AUDIT_ACTIONS.ORDER_PLACED, entityType: "order", entityId: serializedOrders.map((o) => o.order.id).join(","), newValues: { count: serializedOrders.length, total: summary.total, payment_method: "RAZORPAY" } }, req);

    return { summary, orders: serializedOrders };
"""

code = place_order_regex.sub(f'async placeOrder(userId: string, input: PlaceOrderBody, req: Request): Promise<CheckoutResult> {{{new_place_order}\n  }}\n\n  async placeOrderWithVerifiedPayment', code)
code = place_order_verified_regex.sub(f'async placeOrderWithVerifiedPayment(\n    userId: string,\n    input: {{\n      address_id: string;\n      coupon_code?: string;\n      delivery_slot?: string;\n      payment_type?: "FULL" | "ADVANCE";\n      items: Array<{{ product_id: string; quantity: number; selected_unit?: string }}>;\n    }},\n    verifiedPayment: {{\n      razorpay_order_id: string;\n      razorpay_payment_id: string;\n      razorpay_signature: string;\n    }},\n    req: Request\n  ): Promise<CheckoutResult> {{{new_place_order_verified}\n  }}\n}};', code)

with open("backend/src/services/checkout.service.ts", "w") as f:
    f.write(code)

