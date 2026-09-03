const fs = require('fs');
const path = 'backend/src/services/delivery.service.ts';
let code = fs.readFileSync(path, 'utf8');

// I'll replace listDeliveryRequests to query MasterOrder.
// We only want MasterOrders that are ready to be picked up or just accepted?
// The criteria: suborders might have different statuses. But delivery boy picks up the MasterOrder.
// So we list MasterOrders with status PENDING or ACCEPTED and delivery_partner_id = null.
const listDeliveryRequestsReplacement = `async listDeliveryRequests() {
    const rows = await prisma.masterOrder.findMany({
      where: {
        delivery_partner_id: null,
        status: { in: ["PENDING", "ACCEPTED"] },
        orders: {
          some: {
            vendor: { is: { status: "APPROVED" } },
            NOT: [
              { delivery_note: { contains: "self", mode: "insensitive" } },
              { delivery_note: { contains: "pickup", mode: "insensitive" } },
              { delivery_note: { contains: "takeaway", mode: "insensitive" } },
            ],
          },
        },
      },
      orderBy: { created_at: "desc" },
      include: {
        customer: { select: { name: true, phone: true } },
        address: true,
        orders: {
          include: {
            vendor: { select: { id: true, business_name: true, latitude: true, longitude: true, full_address: true, phone: true } },
            items: true,
          }
        },
      },
    });

    return rows.map((m) => {
       const orderNumber = m.order_number;
       const customer = m.customer;
       const address = m.address;
       const vendorList = m.orders.map(o => o.vendor);
       const items = m.orders.flatMap(o => o.items);
       
       return {
         id: m.id,
         order_number: m.order_number,
         status: m.status,
         total: m.total_amount,
         delivery_fee: m.delivery_fee,
         payment_method: m.payment_method,
         payment_status: m.payment_status,
         created_at: m.created_at,
         customer_name: m.customer?.name,
         customer_phone: m.customer?.phone,
         customer_address: m.address?.full_address,
         customer_lat: m.address?.latitude,
         customer_lng: m.address?.longitude,
         vendors: vendorList,
         items: items,
       };
    });
  },`;

code = code.replace(/async listDeliveryRequests\(\) \{[\s\S]*?(?=async listMyDeliveries)/, listDeliveryRequestsReplacement + '\n\n  ');

// listMyDeliveries replacement
const listMyDeliveriesReplacement = `async listMyDeliveries(userId: string) {
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
            vendor: { select: { id: true, business_name: true, latitude: true, longitude: true, full_address: true, phone: true, image_url: true } },
            items: true,
          }
        },
      },
    });
    return rows.map(m => {
       const items = m.orders.flatMap(o => o.items);
       const vendorList = m.orders.map(o => o.vendor);
       
       return {
         id: m.id,
         order_number: m.order_number,
         status: m.status,
         total: m.total_amount,
         delivery_fee: m.delivery_fee,
         payment_method: m.payment_method,
         payment_status: m.payment_status,
         created_at: m.created_at,
         customer_name: m.customer?.name,
         customer_phone: m.customer?.phone,
         customer_address: m.address?.full_address,
         customer_lat: m.address?.latitude,
         customer_lng: m.address?.longitude,
         vendors: vendorList,
         items,
         orders: m.orders,
       };
    });
  },`;

code = code.replace(/async listMyDeliveries[\s\S]*?(?=async acceptDelivery)/, listMyDeliveriesReplacement + '\n\n  ');

fs.writeFileSync(path, code);
