const fs = require('fs');
const path = 'backend/src/services/order.service.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /async listMyOrders[\s\S]*?(?=async listVendorOrders)/,
  `async listMyOrders(userId: string, query: OrderListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const skip = (page - 1) * perPage;
    
    // For customers, return MasterOrders instead of Orders
    const where: any = { user_id: userId, deleted_at: null };
    if (query.status) {
      if (query.status.includes(",")) {
        where.status = { in: query.status.split(",") };
      } else {
        where.status = query.status;
      }
    }

    const [rows, total] = await Promise.all([
      prisma.masterOrder.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: perPage,
        include: {
           orders: {
              include: {
                 vendor: { select: { id: true, business_name: true, image_url: true } },
                 items: true
              }
           }
        }
      }),
      prisma.masterOrder.count({ where })
    ]);

    // Map MasterOrder to a format compatible with the frontend where possible, 
    // or specifically structured for the new MasterOrder UI
    const mappedRows = rows.map((m) => {
       const allItems = m.orders.flatMap(o => o.items);
       const vendors = m.orders.map(o => o.vendor);
       const firstOrder = m.orders[0];
       
       return {
          id: m.id,
          order_number: m.order_number,
          status: m.status,
          total_amount: m.total_amount,
          delivery_fee: m.delivery_fee,
          tax: m.tax,
          payment_method: m.payment_method,
          payment_status: m.payment_status,
          created_at: m.created_at,
          items: allItems,
          vendors: vendors,
          // Fallbacks for older frontend code
          total: m.total_amount,
          vendor: vendors.length === 1 ? vendors[0] : { business_name: 'Multiple Stores' },
          otp_code: firstOrder?.otp_code,
       };
    });

    return { rows: mappedRows, total, page, perPage };
  },

  `
);

fs.writeFileSync(path, code);
