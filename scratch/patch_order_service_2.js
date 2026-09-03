const fs = require('fs');
const path = 'backend/src/services/order.service.ts';
let code = fs.readFileSync(path, 'utf8');

const getOrderForUserReplacement = `async getOrderForUser(userId: string, orderId: string): Promise<any> {
    const m = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: {
         address: true,
         orders: {
            include: {
               vendor: true,
               items: true,
               events: { orderBy: { created_at: "desc" } },
               transactions: true,
            }
         }
      }
    });

    if (!m) {
      throw new NotFoundError("Order not found.");
    }
    if (m.user_id !== userId) {
      throw new ForbiddenError("You do not own this order.");
    }

    const allItems = m.orders.flatMap(o => o.items);
    const vendors = m.orders.map(o => o.vendor);
    const firstOrder = m.orders[0];
    const payment = firstOrder?.transactions?.find(t => t.status === "COMPLETED");

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
       address: m.address,
       // Fallbacks for older frontend code
       total: m.total_amount,
       vendor: vendors.length === 1 ? vendors[0] : { business_name: 'Multiple Stores' },
       otp_code: firstOrder?.otp_code,
       payment,
       events: firstOrder?.events || [],
       orders: m.orders,
    };
  },`;

code = code.replace(/async getOrderForUser[\s\S]*?(?=async getOrderForVendor)/, getOrderForUserReplacement + '\n\n  ');

fs.writeFileSync(path, code);
